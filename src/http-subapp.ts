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
