const postcss = require('postcss');
const fs = require('fs');
const css = fs.readFileSync('src/index.css', 'utf8');
try {
  postcss.parse(css);
  console.log('parsed');
} catch (err) {
  console.error(err.message);
}
