# erasure-cli

For creating and revealing competitions

### Usage

First, create a `.env` file:

```sh
JSON_RPC_URL=http://localhost:8545
MNEMONIC="almost nasty switch remind embark holiday seminar decline space unable all evil"
```

Link your local version of `erasure-daily-contracts`:

```sh
yarn link erasure-daily-contracts
```

In development:

```sh
# Clone repo, then:
yarn build
yarn devlink
# Create a prediction competition that will end in one day
erasure create
```
