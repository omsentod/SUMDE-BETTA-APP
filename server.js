import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';

const port = process.env.PORT || 3000;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    createServer(async (req, res) => {
      try {
        await handle(req, res, parse(req.url, true));
      } catch (err) {
        console.error('Request error:', req.url, err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    })
      .once('error', (err) => {
        console.error(err);
        process.exit(1);
      })
      .listen(port, () => {
        console.log(`> Ready on port ${port}`);
      });
  })
  .catch((err) => {
    console.error('Next.js failed to start:', err);
    process.exit(1);
  });
