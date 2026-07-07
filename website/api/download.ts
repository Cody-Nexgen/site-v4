import { handleDownloadRequest } from '../lib/download-api';

export const config = {
    runtime: 'edge',
};

export default async function handler(request: Request) {
    if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
    }

    return handleDownloadRequest(request);
}
