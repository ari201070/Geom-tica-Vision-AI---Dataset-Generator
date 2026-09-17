const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');

const prefix = `
// Suppress Vite websocket errors that trigger the platform's red overlay
const originalConsoleError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('failed to connect to websocket')) return;
  originalConsoleError(...args);
};

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && (
    String(event.reason).includes('WebSocket closed') ||
    (event.reason.message && event.reason.message.includes('WebSocket closed'))
  )) {
    event.preventDefault();
  }
});
`;

if (!code.includes('originalConsoleError')) {
  fs.writeFileSync('src/main.tsx', prefix + code);
  console.log('main.tsx updated');
} else {
  console.log('main.tsx already has error suppression');
}
