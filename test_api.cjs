const http = require('http');

const data = JSON.stringify({
  count: 80,
  startIdx: 0,
  location: "Coliseo, Roma",
  usePro: false,
  customKey: "" // We don't have the user's key, so we can't fully test it!
});

// Without the user's API key, we will just get "No API Key" or invalid key error.
