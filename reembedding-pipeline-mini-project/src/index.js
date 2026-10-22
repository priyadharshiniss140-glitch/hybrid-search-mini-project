import express from 'express';
import { searchRouter } from './routes/search.js';

const app = express();
app.use(express.json());
app.use(searchRouter);

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Search service listening on port ${PORT}`);
    console.log(`EMBEDDING_VERSION=${process.env.EMBEDDING_VERSION || 'v1'}`);
    console.log(`EMBEDDING_MODEL=${process.env.EMBEDDING_MODEL || 'text-embedding-ada-002'}`);
  });
}

export default app;
