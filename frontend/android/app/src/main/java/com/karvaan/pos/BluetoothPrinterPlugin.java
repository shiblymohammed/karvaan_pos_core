package com.karvaan.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Base64;
import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class BluetoothPrinterPlugin extends Plugin {

    // Standard SPP (Serial Port Profile) UUID used by ESC/POS thermal printers
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private boolean hasBluetoothPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothPermission()) {
                requestPermissionForAlias("bluetooth", call, "permissionCallback");
                return;
            }

            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("Device does not support Bluetooth");
                return;
            }

            if (!adapter.isEnabled()) {
                call.reject("Bluetooth is currently turned off. Please turn it on in Android settings.");
                return;
            }

            Set<BluetoothDevice> bondedDevices = adapter.getBondedDevices();
            JSArray devicesArray = new JSArray();

            if (bondedDevices != null) {
                for (BluetoothDevice device : bondedDevices) {
                    JSObject devObj = new JSObject();
                    String devName = device.getName();
                    devObj.put("name", devName != null ? devName : "Unknown Device");
                    devObj.put("address", device.getAddress());
                    devicesArray.put(devObj);
                }
            }

            JSObject ret = new JSObject();
            ret.put("devices", devicesArray);
            call.resolve(ret);
        } catch (SecurityException se) {
            call.reject("Bluetooth permission not granted: " + se.getMessage());
        } catch (Exception e) {
            call.reject("Failed to list Bluetooth devices: " + e.getMessage());
        }
    }

    @PluginMethod
    public void print(PluginCall call) {
        String address = call.getString("address");
        String base64Data = call.getString("data");

        if (address == null || address.trim().isEmpty()) {
            call.reject("Bluetooth printer MAC address is required");
            return;
        }

        if (base64Data == null || base64Data.trim().isEmpty()) {
            call.reject("No print data provided");
            return;
        }

        executor.execute(() -> {
            BluetoothSocket socket = null;
            OutputStream outputStream = null;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothPermission()) {
                    call.reject("Bluetooth permission not granted");
                    return;
                }

                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null || !adapter.isEnabled()) {
                    call.reject("Bluetooth is turned off or not supported");
                    return;
                }

                // Cancel discovery before connecting as it slows down connection
                adapter.cancelDiscovery();

                BluetoothDevice device = adapter.getRemoteDevice(address.trim());
                if (device == null) {
                    call.reject("Bluetooth device not found: " + address);
                    return;
                }

                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

                // Attempt standard SPP RFCOMM connection
                try {
                    socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                } catch (Exception primaryEx) {
                    // Fallback to reflection on channel 1 for low-cost thermal printers
                    try {
                        Method m = device.getClass().getMethod("createRfcommSocket", new Class[]{int.class});
                        socket = (BluetoothSocket) m.invoke(device, 1);
                        if (socket != null) {
                            socket.connect();
                        } else {
                            throw primaryEx;
                        }
                    } catch (Exception fallbackEx) {
                        call.reject("Could not connect to printer: " + primaryEx.getMessage());
                        return;
                    }
                }

                outputStream = socket.getOutputStream();
                outputStream.write(bytes);
                outputStream.flush();

                // Small pause to allow hardware buffer to process before socket close
                Thread.sleep(150);

                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);

            } catch (Exception e) {
                call.reject("Print failed: " + e.getMessage());
            } finally {
                try {
                    if (outputStream != null) outputStream.close();
                } catch (Exception ignored) {}
                try {
                    if (socket != null) socket.close();
                } catch (Exception ignored) {}
            }
        });
    }

    @PluginMethod
    public void isBluetoothEnabled(PluginCall call) {
        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        boolean enabled = adapter != null && adapter.isEnabled();
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }
}
