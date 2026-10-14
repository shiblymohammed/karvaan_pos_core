import { authorizedFetch } from './authFetch';

export async function uploadMenuImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await authorizedFetch('/upload?type=menu', {
    method: 'POST',
    body: formData,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = Array.isArray(data?.message) ? data.message.join('. ') : data?.message;
    if (typeof message === 'string' && message) throw new Error(message);
    if (response.status === 413) throw new Error('This image exceeds the server upload size limit. Choose a smaller image.');
    if (response.status === 404 || response.status === 405) {
      throw new Error(`Image upload route unavailable (HTTP ${response.status}). Check the server proxy configuration.`);
    }
    throw new Error(`Image upload failed (HTTP ${response.status}). Please try again.`);
  }
  if (typeof data?.url !== 'string' || !data.url) {
    throw new Error('The server did not return an image URL. Check the server upload route.');
  }
  return data.url;
}
