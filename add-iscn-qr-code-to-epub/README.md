# Add ISCN QR Code to EPUB

Add an ISCN QR code page to the end of EPUB files.

## Installation

Run with `node.js >= 16`, `npm >= 8`.

```bash
npm install
```

## Usage

1. Create ISCN for your eBooks. You can use [iscn-batch-uploader](../iscn-batch-uploader) to create ISCN in batch.

2. Put your .epub files in `./input` folder.

3. Update `./list.csv` with your eBook filename and ISCN ID.

4. Run the script with: 
    ```bash
    npm run start
    ```
5. The output files will be in `./output` folder.

## Configuration

Change the config in `./config.js`

You can set the text and `language` to show on the QR code page.
