import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';
import * as os from 'os';

export interface PrintJobData {
  ip: string;
  port: number;
  type: 'KOT' | 'RECEIPT' | 'TEST';
  restaurantName?: string;
  orderNumber?: string;
  items?: any[];
  grandTotal?: number;
  notes?: string;
}

@Injectable()
export class PrinterService {
  private readonly logger = new Logger(PrinterService.name);
  private printQueue: { job: PrintJobData; resolve: (value: boolean) => void }[] = [];
  private isPrinting = false;

  // ESC/POS Commands
  private readonly CMD = {
    INIT: Buffer.from([0x1B, 0x40]),           // Initialize
    ALIGN_LEFT: Buffer.from([0x1B, 0x61, 0x00]), // Left align
    ALIGN_CENTER: Buffer.from([0x1B, 0x61, 0x01]), // Center align
    BOLD_ON: Buffer.from([0x1B, 0x45, 0x01]),    // Emphasized mode on
    BOLD_OFF: Buffer.from([0x1B, 0x45, 0x00]),   // Emphasized mode off
    TEXT_NORMAL: Buffer.from([0x1D, 0x21, 0x00]), // Normal text
    TEXT_DOUBLE_H: Buffer.from([0x1D, 0x21, 0x01]), // Double height
    TEXT_DOUBLE_W: Buffer.from([0x1D, 0x21, 0x10]), // Double width
    TEXT_DOUBLE_HW: Buffer.from([0x1D, 0x21, 0x11]), // Double height & width
    CUT: Buffer.from([0x1D, 0x56, 0x41, 0x10]),  // Cut paper
    LF: Buffer.from([0x0A]),                     // Line feed
  };

  /**
   * Tests TCP connection to a printer
   */
  async testConnection(ip: string, port: number = 9100): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000); // 2 second timeout for testing

      socket.on('connect', () => {
        this.logger.log(`[Printer] Successfully connected to ${ip}:${port}`);
        // Send a quick test print
        socket.write(this.CMD.INIT);
        socket.write(this.CMD.ALIGN_CENTER);
        socket.write(Buffer.from('--- CONNECTION SUCCESSFUL ---\n\n'));
        socket.write(this.CMD.CUT);
        socket.end();
        resolve(true);
      });

      socket.on('timeout', () => {
        this.logger.warn(`[Printer] Timeout connecting to ${ip}:${port}`);
        socket.destroy();
        resolve(false);
      });

      socket.on('error', (err) => {
        this.logger.warn(`[Printer] Connection error ${ip}:${port} - ${err.message}`);
        resolve(false);
      });

      socket.connect(port, ip);
    });
  }

  /**
   * Scans the local network for devices with port 9100 open
   */
  async scanNetwork(port: number = 9100): Promise<{ip: string, name: string}[]> {
    this.logger.log(`[Printer] Scanning network for open port ${port}...`);
    const foundPrinters: {ip: string, name: string}[] = [];
    
    // Get local IP to determine subnet
    const interfaces = os.networkInterfaces();
    let localIp = '';
    
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp) break;
    }

    if (!localIp) return [];

    const subnet = localIp.substring(0, localIp.lastIndexOf('.'));
    const scanPromises: Promise<void>[] = [];

    // Scan .2 to .254 in parallel batches to prevent EMFILE
    const ips = Array.from({ length: 253 }, (_, i) => `${subnet}.${i + 2}`);
    
    for (let i = 0; i < ips.length; i += 50) {
      const batch = ips.slice(i, i + 50);
      const batchPromises = batch.map(targetIp => {
        if (targetIp === localIp) return Promise.resolve();
        return new Promise<void>((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(800); // 800ms timeout for fast scanning
          
          socket.on('connect', () => {
            foundPrinters.push({ ip: targetIp, name: `Discovered Printer (${targetIp})` });
            socket.destroy();
            resolve();
          });
          
          socket.on('error', () => { socket.destroy(); resolve(); });
          socket.on('timeout', () => { socket.destroy(); resolve(); });
          
          socket.connect(port, targetIp);
        });
      });
      await Promise.all(batchPromises);
    }
    
    this.logger.log(`[Printer] Scan complete. Found ${foundPrinters.length} printers.`);
    return foundPrinters;
  }

  /**
   * Sends a KOT or Receipt job to the printer
   */
  async printJob(job: PrintJobData): Promise<boolean> {
    return new Promise((resolve) => {
      this.printQueue.push({ job, resolve });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isPrinting || this.printQueue.length === 0) return;
    this.isPrinting = true;

    const { job, resolve } = this.printQueue.shift()!;

    const socket = new net.Socket();
    socket.setTimeout(3000);

      socket.on('connect', () => {
        this.logger.log(`[Printer] Connected for job type ${job.type} at ${job.ip}:${job.port}`);
        
        let buffer = Buffer.concat([this.CMD.INIT]);

        if (job.type === 'KOT') {
          buffer = Buffer.concat([buffer, this.buildKOT(job)]);
        } else if (job.type === 'RECEIPT') {
          buffer = Buffer.concat([buffer, this.buildReceipt(job)]);
        }

        buffer = Buffer.concat([buffer, this.CMD.LF, this.CMD.LF, this.CMD.LF, this.CMD.LF, this.CMD.CUT]);
        
        socket.write(buffer, () => {
          socket.end();
          resolve(true);
          this.isPrinting = false;
          this.processQueue();
        });
      });

      socket.on('error', (err) => {
        this.logger.error(`[Printer] Failed to print to ${job.ip}:${job.port} - ${err.message}`);
        resolve(false);
        this.isPrinting = false;
        this.processQueue();
      });

      socket.on('timeout', () => {
        this.logger.error(`[Printer] Timeout while printing to ${job.ip}:${job.port}`);
        socket.destroy();
        resolve(false);
        this.isPrinting = false;
        this.processQueue();
      });

      socket.connect(job.port, job.ip);
  }

  private buildKOT(job: PrintJobData): Buffer {
    let bufs: Buffer[] = [];
    
    // Header
    bufs.push(this.CMD.ALIGN_CENTER);
    bufs.push(this.CMD.TEXT_DOUBLE_HW);
    bufs.push(Buffer.from('*** KOT ***\n'));
    
    // Meta
    bufs.push(this.CMD.TEXT_NORMAL);
    bufs.push(Buffer.from(`Order: ${job.orderNumber || 'N/A'}\n`));
    bufs.push(Buffer.from(`Time: ${new Date().toLocaleTimeString()}\n`));
    bufs.push(Buffer.from('--------------------------------\n'));
    
    // Items
    bufs.push(this.CMD.ALIGN_LEFT);
    bufs.push(this.CMD.TEXT_DOUBLE_H);
    if (job.items) {
      for (const item of job.items) {
        bufs.push(Buffer.from(`${item.quantity} x ${item.name || item.product?.name}\n`));
        if (item.notes) {
          bufs.push(this.CMD.TEXT_NORMAL);
          bufs.push(Buffer.from(`   * ${item.notes}\n`));
          bufs.push(this.CMD.TEXT_DOUBLE_H);
        }
      }
    }
    
    bufs.push(this.CMD.TEXT_NORMAL);
    bufs.push(Buffer.from('--------------------------------\n'));
    
    return Buffer.concat(bufs);
  }

  private buildReceipt(job: PrintJobData): Buffer {
    let bufs: Buffer[] = [];
    
    // Header
    bufs.push(this.CMD.ALIGN_CENTER);
    bufs.push(this.CMD.TEXT_DOUBLE_HW);
    bufs.push(Buffer.from(`${job.restaurantName || 'KARVAAN POS'}\n`));
    bufs.push(this.CMD.TEXT_NORMAL);
    bufs.push(Buffer.from(`Order: ${job.orderNumber || 'N/A'}\n`));
    bufs.push(Buffer.from(`Time: ${new Date().toLocaleString()}\n`));
    bufs.push(Buffer.from('--------------------------------\n'));
    
    // Items
    bufs.push(this.CMD.ALIGN_LEFT);
    if (job.items) {
      for (const item of job.items) {
        const qty = item.quantity.toString().padEnd(3, ' ');
        const name = (item.name || item.product?.name || '').substring(0, 18).padEnd(20, ' ');
        const price = (item.price * item.quantity).toFixed(2).padStart(8, ' ');
        bufs.push(Buffer.from(`${qty} ${name} ${price}\n`));
        if (item.notes) {
          bufs.push(Buffer.from(`   * ${item.notes}\n`));
        }
      }
    }
    
    bufs.push(Buffer.from('--------------------------------\n'));
    bufs.push(this.CMD.ALIGN_CENTER);
    bufs.push(this.CMD.TEXT_DOUBLE_HW);
    bufs.push(Buffer.from(`TOTAL: ${job.grandTotal?.toFixed(2) || '0.00'}\n`));
    
    bufs.push(this.CMD.TEXT_NORMAL);
    bufs.push(this.CMD.LF);
    bufs.push(Buffer.from('Thank you for visiting!\n'));
    
    return Buffer.concat(bufs);
  }
}
