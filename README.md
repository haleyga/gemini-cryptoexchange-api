## About
This package provides a modern javascript solution for interfacing with the [Gemini cryptoexchange API][api_ref]. 
Currently, only the REST API has been implemented.  Support for for the Push API is in the works.

This library is intended to be used with ES6, TypeScript, etc.  In the interest of moving towards the more-readable 
`async/await` pattern, callbacks are not supported.  Only native Promise-based interaction is supported.

This library does not track your request rate.  Gemini throttles/disables api access if the request rate exceeds 
certain limits.  *It is the responsibility of the user to track rate limits.*

## Getting Started

#### Install

###### npm
```bash
npm i gemini-cryptoexchange-api
```

###### yarn
```bash
yarn add gemini-cryptoexchange-api
```

#### Quick Start

###### TypeScript
```typescript
import { getClient, IGeminiClient } from 'gemini-cryptoexchange-api';

const main = async (): Promise<{}> => {
    try {
        const client: IGeminiClient = getClient({
            publicKey : '', // Your public key
            privateKey: '', // Your private key
        });

        const { status, data } = await client.getAvailableBalances();
        return Promise.resolve(data);
    } catch (err) {
        return Promise.reject(err);
    }
};

main().then(data => console.log(data))
      .catch(err => console.error(err));
```

###### JavaScript
*This example shows usage without `async/await`.*
```javascript
const gemini = require('gemini-cryptoexchange-api');

const client = gemini.getClient({
    publicKey : '', // Your public key
    privateKey: '', // Your private key
});

client.getAvailableBalances()
      .then(response => {
          const { status, data } = response;
          console.log(data);
      })
      .catch(err => console.error(err));

```

*Note: the remainder of this README.md will use TypeScript examples.*

## API Detail

All endpoints are available via the client.  If authentication keys are provided during client construction, public 
and private endpoints will succeed.  If no keys are given, only public endpoints will succeed.  Private endpoints 
will return a promise rejection when not authenticated, so be sure to properly trap your errors.

***No attempt is made to mitigate private calls when not authenticated.  It is the responsibility of the user to trap 
any errors resulting from incorrect/invalid authentication.***

A few convenience properties and methods are provided:

##### rawAgent
This gives the user access to the underlying request forwarder.  While not very useful to a user, it does expose the 
request signing algorithm via `rawAgent#signMessage`.

##### isUpgraded()
This method returns a boolean corresponding to whether or not the user has provided API keys to the client.

##### upgrade()
This method allows a user to upgrade a public client with credentials.  If the client already has credentials, this 
method will replace the existing keys.

### Public Requests
In order to place requests with public endpoints, simply instantiate the client with no parameters:

```typescript
const client: IGeminiClient = getClient(); 
```

### Private Requests

##### Authentication
In order to authenticate a client with the Gemini API, a private request must provide a public key and a correctly 
signed request.  This library handles request signatures - the user simply provides a public/private key pair. You 
can [generate your own API keys][api_keys_ref] through the Gemini interface.

[api_ref]: https://docs.gemini.com
[api_keys_ref]: https://exchange.gemini.com/settings/api
