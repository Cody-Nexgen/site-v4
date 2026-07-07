let audio = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.target !== 'offscreen') return;

    switch (msg.type) {
        case 'PLAY':
            playAudio(msg.source);
            break;
        case 'PAUSE':
            pauseAudio();
            break;
        case 'SET_VOLUME':
            if (audio) audio.volume = msg.volume / 100;
            break;
    }
});

function playAudio(source) {
    if (audio) {
        audio.pause();
    }
    // For now, we'll use a hardcoded rain sound if source is 'rain'
    // In a real app, you'd map sources to URLs
    const url = source === 'rain'
        ? 'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-1605.mp3'
        : source; // Assume source is URL otherwise

    audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.5; // Default 50%
    audio.play().catch(e => console.error("Audio play error:", e));
}

function pauseAudio() {
    if (audio) {
        audio.pause();
    }
}
