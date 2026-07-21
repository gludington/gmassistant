interface Env {
  API: Fetcher;
}

// Proxy all /uploads/* requests to the gmassisstant-api Worker via Service Binding.
// Configure the binding in the Cloudflare Pages dashboard:
//   Settings → Functions → Service Bindings → Add: name=API, service=gmassisstant-api
export async function onRequest(context: EventContext<Env, string, unknown>) {
  return context.env.API.fetch(context.request);
}
