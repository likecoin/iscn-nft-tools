# mint NFT

mint NFT on LikeCoin chain from metadata or ISCN ID

## Installation

Run with `node.js = 14`

```bash
npm install
```

## Usage

```bash
Usage:
  MNEMONIC="...." node index.js --nft-count 100

Required Paramters:
  --nft-count: How many NFT to mint

Optional Parameters:
  --iscn-id: Use existing ISCN ID. If ISCN ID is not set, data in ./data/iscn.json will be used.
  --class-id: Use existing NFT class ID.  If NFT class ID is not set, data in ./data/nft.json will be used.
  --nft-max-supply: Define max supply for new NFT class

```

## Configuration

When creating new [ISCN](https://iscn.io), change the ISCN data in `./data/iscn.json`

When creating new [NFT class](https://docs.like.co/developer/likenft/metadata) or minting, change the data in `./data/nft.json`

Set environment variable `MNEMONIC`, which is your mnemonic phrase, when running the script
