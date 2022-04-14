# ISCN Batch Uploader

Batch upload your content metadata from csv to ISCN

## Installation

Run with `node.js >= 10`, `npm >= 6`.

```bash
npm install
```

## Configuration

Change the config in `./config/config.js`

Where `ISCN_RPC_URL` is the node RPC endpoint for LikeCoin chain, `COSMOS_MNEMONIC` is the mnemonic of your wallet, `COSMOS_DENOM` is the denom of chain (testnet: nanoekil, mainnet: nanolike).

## Usage

```bash
node index.js [input.csv]
```

The resulting transaction hash and ISCN ID will show on both console and `./output.csv`

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[GNU GPLv3](https://choosealicense.com/licenses/gpl-3.0/)