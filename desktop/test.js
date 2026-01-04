console.log('Testing electron require...');
try {
    const electron = require('electron');
    console.log('electron module:', typeof electron);
    console.log('electron.app:', electron.app);
    console.log('keys:', Object.keys(electron));
} catch (e) {
    console.error('Error:', e);
}
