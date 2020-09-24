# loopback4-example-multiservers

This application illustrates how to set up multiple RestServers for use cases such as:

1. Redirect http requests to https
2. Expose health check with http only
3. Expose admin APIs using a different port

## Run the application

```sh
git clone git@github.com:raymondfeng/loopback4-example-multiservers.git
cd loopback4-example-multiservers
npm ci
npm start
```

You can also run `node .` to skip the build step.

Open https://127.0.0.1:3000 in your browser.

To test out endpoints via http:

1. Open http://127.0.0.1:3000/health in your browser.

2. Open http://127.0.0.1:3000/ping in your browser.

## Tests

```sh
npm test
```

## Behind the scenes

The main application is scaffolded with LoopBack CLI. The default RestServer
is configured to use `https` in `src/index.ts`. The SSL key and certificate are
generated using openssl and loaded from `ssl-config`.

```ts
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
```

To add another RestServer, we add a `SubApplicationForHttp` in `src/http-subapp.ts`.

```ts
import {
  Application,
  ApplicationConfig,
  Binding,
  BindingKey,
  ContextTags,
  CoreBindings,
  inject,
  lifeCycleObserver,
} from '@loopback/core';
import {HealthComponent, HealthTags} from '@loopback/health';
import {
  registerMiddleware,
  RestApplication,
  RestComponent,
} from '@loopback/rest';

export const SUB_APPLICATION_HTTP = BindingKey.create<Application>(
  'sub-application-for-http',
);

/**
 * A sub-application for health check endpoint to listen on a separate http port
 */
@lifeCycleObserver('', {
  tags: {[ContextTags.KEY]: SUB_APPLICATION_HTTP},
})
export class SubApplicationForHttp extends Application {
  constructor(
    @inject(CoreBindings.APPLICATION_INSTANCE) mainApp: RestApplication,
    @inject(CoreBindings.APPLICATION_CONFIG) mainAppConfig: ApplicationConfig,
  ) {
    const options = {...mainAppConfig};
    options.rest = {
      ...options.rest,
      // Set the port number for the health endpoint
      // 1. `HTTP_PORT environment var
      // 2. 0
      // 3. The next port for the billing app
      port: +(process.env.HTTP_PORT ?? options.rest.port === 0
        ? 0
        : options.rest.port + 1),
      protocol: 'http',
    };
    super(options);

    // Mount Rest component
    this.component(RestComponent);

    // Mount Health component
    this.component(HealthComponent);

    // Register a middleware to handle https redirect
    registerMiddleware(
      this,
      (ctx, next) => {
        if (ctx.request.path !== '/health') {
          ctx.response.redirect(`${mainApp.restServer.rootUrl}/ping`);
          return ctx.response;
        }
        return next();
      },
      {},
    );

    // Register live/ready check extensions from the main application
    mainApp
      .find(
        b =>
          b.tagNames.includes(HealthTags.LIVE_CHECK) ||
          b.tagNames.includes(HealthTags.READY_CHECK),
      )
      .forEach(b => {
        this.add(b as Binding<unknown>);
      });
  }
}
```

The key techniques are:

1. Create a sub application that mounts the `RestComponent` to expose REST
   endpoints over `http`.

2. Decorate the class as `lifeCycleObserver` so that it can be started/stopped
   along with the main application.

3. Register the sub application in the main application (`src/application.ts`):

```ts
// Register http endpoints
this.lifeCycleObserver(SubApplicationForHttp);
```

4. Mount the `HealthComponent` for the sub application and bind health check
   related extensions to the sub application as it does not inherit from the main
   application.

5. Register a middleware in the sub application to redirect `http` requests to
   `https` served by the main application.

## What's next

Please check out [LoopBack 4 documentation](https://loopback.io/doc/en/lb4/) to
understand how you can continue to add features to this application.

[![LoopBack](<https://github.com/strongloop/loopback-next/raw/master/docs/site/imgs/branding/Powered-by-LoopBack-Badge-(blue)-@2x.png>)](http://loopback.io/)
