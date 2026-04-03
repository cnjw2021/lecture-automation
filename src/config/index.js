require('dotenv').config();
const path = require('path');

const ROOT_DIR = path.join(__dirname, '../../');

module.exports = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  paths: {
    root: ROOT_DIR,
    data: path.join(ROOT_DIR, 'data'),
    audio: path.join(ROOT_DIR, 'remotion-project/public/audio'),
    captures: path.join(ROOT_DIR, 'remotion-project/public/captures'),
  },
  model: {
    name: "gemini-1.5-flash",
  }
};
