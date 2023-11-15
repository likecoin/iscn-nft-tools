# NFT Book Batch Uploader

Batch create and list NFT Book from ISCN

## Installation

Run with `node.js >= 16`, `npm >= 8`.

```bash
npm install
```

## Usage

1. Prepare `list.csv` with the ISCNs and the corresponding metadata of the books to be minted and listed.
2. Update `MNEMONIC` in `./config.js` with the mnemonic of the wallet that owns the ISCNs.
3. Update `NFT_PREFIX` and `CLASS_SYMBOL` in `./config.js` to specify the prefix of the NFTs and the symbol of the NFT class.
4. To mint NFTs and list them as NFT Books, run below command:
    ```bash
    node index.js [list.csv]
    ```
5. The script will append a `classId` column to the CSV and update it with the minted NFT class IDs.
