<div align="center">

![project logo](https://8565014-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F-LL4mdaVjNgL6A1--PV0-1972196547%2Fuploads%2Fgit-blob-67a9bfa664bab32a8f64e5239545677cc8c98a26%2FLCF001-key%20visual%20v4.1-1.jpg?alt=media)

# mint NFT
Mint NFT on LikeCoin chain based on metadata in JSON or given ISCN ID

[[Discord]][discord link] [[Blog]][blog link] [[Twitter]][twitter link] [[Docs]][docs link] [[Writing NFT]][Liker Land link]

[discord link]: https://discord.gg/likecoin
[blog link]: https://blog.like.co
[twitter link]: https://twitter.com/@likecoin
[Liker Land link]: https://liker.land
[docs link]: https://docs.like.co

</div>

## Table of Contents

1. [Installation](#installation)
2. [Usage](#usage)
3. [Configuration](#configuration)
3. [Data](#data)
4. [Glossary](#glossary)


### Installation

Run with `node.js = 14`

```bash
npm install
```

### Usage

Procedure:
1. Prepare the data files
2. Run the script

On production chain
```bash
MNEMONIC="...." node index.js --nft-count ${NUMBER_OF_NFT} --iscn-id iscn://xxx
```
<br>

On testnet
```bash
IS_TESTNET=TRUE MNEMONIC="...." node index.js --nft-count ${NUMBER_OF_NFT} --iscn-id iscn://xxx
```

<br>

| Parameter | Argument | Example | Required |
| --- | --- | --- | --- |
| nft-count | An integer.  Total number of NFT to be minted. | --nft-count 100 | YES |
| iscn-id | A string.  The ISCN ID that the NFT is referring to. Should be provided if `--create-new-iscn` is not set. | --iscn-id iscn://likecoin-chain/IKI9PueuJiOsYvhN6z9jPJIm3UGMh17BQ3tEwEzslQo/3  | NO |
| create-new-iscn | A boolean.  If true or set, the script will create a new ISCN record based on iscn.json. Cannot be used with `--iscn-id` or `--class-id`. | --create-new-iscn | NO |
| class-id | A string.  The NFT class ID that the NFT belongs to. It is used in the case to mint additional NFTs within the same Class (collection).  The script will create one based on nft-class.json if not specified. | --class-id likenft1yhsps5l8tmeuy9y7k0rjpx97cl67cjkjnzkycecw5xrvjjp6c5yqz0ttmc | NO |
| nft-max-supply | An integer.  Maximum number of NFTs that can be minted in an NFT class.  No limitation if not specified. | --nft-max-supply 1000 | NO |
---


### Configuration

When creating new [ISCN](https://iscn.io), change the ISCN data in `./data/iscn.json`

When creating new [NFT class](https://docs.like.co/developer/likenft/metadata) or minting, change the data in `./data/nft.json`

Set environment variable `MNEMONIC`, which is your mnemonic phrase; `IS_TESTNET=TRUE` if you want to mint NFT on testnet, when running the script.

---
### Data

The values of the data files overrides each other in the order: `nfts.csv` > `nft_class.json` > `iscn.json`.  

**nfts.csv**

| Field | Description   |
| --- | --- |
| nftId | The unique NFT ID under a specific NFT class ID.  The system will generate a random ID if it is not specified. [Format requirement](https://docs.like.co/developer/likenft/likecoin-nft-module-spec#mintnft) .   |
| uri | The URI of an API to return an image that serves as the og image of the NFT, which is displayed in the NFT detail view of liker.land. The uri parameter override the “image” parameter. |
| image | The URL of an image that serves as the og image of the NFT, which is displayed in the NFT detail view of liker.land. |
| metadata | Metadata of the NFT image of any related parameter which is expected to be record on chain. |

<br>

**nft_default.json**

| Field | Description |
| --- | --- |
| uri | If image info is not available in nfts.csv, the image will be provided first by this this URI and second by the metadata→image field.  This uri is supposed to be a web API. |
| metadata → name | default NFT name if the field is not specified in nfts.csv metadata |
| metadata → description | default NFT description if the field is not specified in nfts.csv metadata |
| metadata → image | If image info is not available in nfts.csv, the image will be provided first by this this URI and second by the metadata→image field.   |
| metadata → external_url | Link to the “View Content” button in the NFT detail page, under the main NFT image |

<br>

**nft_class.json**

| Field | Description |
| --- | --- |
| name | NFT title displaying in portfolio/dashboard, class view and detail view.   |
| description | NFT description displaying in class view and detail view.   |
| symbol | Reserved |
| uri | The URI of an API to return an image that serves as the og image of the NFT class, which is displayed in the portfolio/dashboard and class view of liker.land, and may display in detail view as well if nfts.csv and nfts_default.json are not set properly. |
| metadata → image | The URL of an image that serves as the og image of the NFT, which is displayed in the portfolio/dashboard and class view of liker.land, and may display in detail view as well if nfts.csv and nfts_default.json are not set properly. |
| metadata → external_url | URL of the content |
| metadata → message | The “creator message” that is appended to every NFT in the same class |
| metadata → nft_meta_collection_id | NFT category, e.g.: nft_book, nft_mail, nft_photo, nft_illustration etc.  Liker Land use this field to decide which section the NFT is displayed. |
| metadata → nft_meta_collection_name | NFT category name |
| metadata → nft_meta_collection_descrption | NFT category description |

<br>

**iscn.json**

| Field | Description |
| --- | --- |
| contentMetadata → url | URL of the content |
| contentMetadata → name | Title of the ISCN |
| contentMetadata → type | “Book” |
| contentMetadata → version | ISCN version number |
| contentMetadata → context | "http://schema.org/" |
| contentMetadata → keywords | Format: “a,b,c,d” |
| contentMetadata → usageInfo | e.g.: CC BY-SA 4.0 |
| contentMetadata → description | Description of the ISCN |
| stakeholders | list of stakeholder info, e.g. <br>{<br>"contributionType":"http://schema.org/author",<br>"entity":<br>{<br>"@id":"like123456789012345678901234567890",<br>"name":"Authors Name"<br>},<br>"rewardProportion":"2"<br>} |
| contentFingerprint | decentralized storage hash, e.g.: <br>"ipfs://QmVsa6WuHLiZtyfwQrFjgxwLvVqMPsvvvusTdCKmTyqkca",<br>"ar://e-bMr7c3O_sm20zb7X5Vu870Q8b-Pc7eIxmjYXgJmsI” |
| recordNotes | reserved |

---
### Glossary

**Class view**

The page of a group of NFTs.

Testnet Example:

[https://rinkeby.liker.land/nft/class/likenft1q7uzcmmu54h28ynuyvpx2mffj34wvrhyaf84df3paztaftyxy0fq4dzf49](https://rinkeby.liker.land/nft/class/likenft1q7uzcmmu54h28ynuyvpx2mffj34wvrhyaf84df3paztaftyxy0fq4dzf49)

**Detail view**

The page of a particular NFT.

Testnet Example:

[https://rinkeby.liker.land/nft/class/likenft1q7uzcmmu54h28ynuyvpx2mffj34wvrhyaf84df3paztaftyxy0fq4dzf49/moneyverse0001](https://rinkeby.liker.land/nft/class/likenft1q7uzcmmu54h28ynuyvpx2mffj34wvrhyaf84df3paztaftyxy0fq4dzf49/moneyverse0001)

**Testnet Faucet**

A Discord bot to get LikeCoin on testnet (EKIL) for testing.  [Procedure](https://docs.like.co/general-guides/community/faucet-testnet)
