import fs from 'fs';
import path from 'path';
import {ApplicationConfig, DemoApplication} from './application';

export * from './application';

export async function main(options: ApplicationConfig = {}) {
  const app = new DemoApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  console.log(`Server is running at ${url}`);
  console.log(`Try ${url}/ping`);

  const httpUrl = await app.getHttpUrl();
  console.log('Health check: %s/health', httpUrl);
  console.log('%s/ping will be redirected to %s/ping', httpUrl, url);

  return app;
}

if (require.main === module) {
  // Run the application
  const config = {
    rest: {
      port: +(process.env.HTTPS_PORT ?? 3000),
      host: process.env.HOST,
      protocol: 'https',
      cert: fs.readFileSync(
        path.join(__dirname, '../ssl-config/server-cert.pem'),
      ),
      key: fs.readFileSync(
        path.join(__dirname, '../ssl-config/server-key.pem'),
      ),
      // The `gracePeriodForClose` provides a graceful close for http/https
      // servers with keep-alive clients. The default value is `Infinity`
      // (don't force-close). If you want to immediately destroy all sockets
      // upon stop, set its value to `0`.
      // See https://www.npmjs.com/package/stoppable
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true,
      },
    },
  };
  main(config).catch(err => {
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}
