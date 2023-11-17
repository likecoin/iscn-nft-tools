# NFT Book Mint and List

Batch mint and list NFT Book from ISCN

## Installation

Run with `node.js >= 16`, `npm >= 8`.

```bash
npm install
```

## Usage

1. Prepare `list.csv` with the ISCNs and the corresponding metadata of the books to be minted and listed.
2. Update `MNEMONIC` or `PRIVATE_KEY` in `./config.js` with the mnemonic or private key of the wallet that owns the ISCNs.
3. Update `NFT_PREFIX`, `CLASS_SYMBOL`, `NFT_META_COLLECTION_ID`, `NFT_META_COLLECTION_NAME`, `NFT_META_COLLECTION_DESCRIPTION` in `./config.js` with the desired values. For example:
    ```js
    export const NFT_PREFIX = 'PGBOOK';
    export const CLASS_SYMBOL = 'PGBOOK';
    export const NFT_META_COLLECTION_ID = 'project_gutenberg_nft_book';
    export const NFT_META_COLLECTION_NAME = 'Project Gutenberg NFT Book';
    export const NFT_META_COLLECTION_DESCRIPTION = 'Project Gutenberg NFT Book by Liker Land';
    ```
4. To mint NFTs and list them as NFT Books, run below command:
    ```bash
    node index.js [list.csv]
    ```
5. The script will append a `classId` column to the CSV and update it with the minted NFT class IDs.
