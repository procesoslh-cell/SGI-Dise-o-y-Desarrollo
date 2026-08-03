import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
app.listen(env.port, () => {
  console.log(`SGI Diseño y Desarrollo v1.8.2 escuchando en http://localhost:${env.port}`);
});
