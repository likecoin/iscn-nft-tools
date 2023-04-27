export const IS_TESTNET = false

export const CHAIN_ID = IS_TESTNET
  ? 'likecoin-public-testnet-5'
  : 'likecoin-chain-2'
export const RPC_URL = IS_TESTNET
  ? 'https://node.testnet.like.co/rpc/'
  : 'https://mainnet-node.like.co/rpc/'
export const LCD_URL = IS_TESTNET
  ? 'https://node.testnet.like.co'
  : 'https://mainnet-node.like.co'
export const LIKER_LAND_HOST = `${IS_TESTNET ? 'rinkeby.' : ''}liker.land`

export const LIKER_NFT_FEE_WALLET = IS_TESTNET
  ? 'like1yney2cqn5qdrlc50yr5l53898ufdhxafqz9gxp'
  : 'like10ywsmztkxjl55xarxnhlxwc83z9v2hkxtsajwl'

export const LIKE_CO_API = `https://api.${IS_TESTNET ? 'rinkeby.' : ''}like.co`
export const APP_LIKE_CO_URL = `https://app.${IS_TESTNET ? 'rinkeby.' : ''}like.co`
export const LIKER_LAND_URL = `https://${LIKER_LAND_HOST}`

export const ARWEAVE_ENDPOINT = 'https://arweave.net'

export const IPFS_VIEW_GATEWAY_URL = 'https://ipfs.io/ipfs'

export const CHAIN_EXPLORER_URL = IS_TESTNET ? 'https://node.testnet.like.co/cosmos/tx/v1beta1/txs' : 'https://www.mintscan.io/likecoin/txs'

export const NFT_MARKETPLACE_URL = IS_TESTNET ? 'https://likecoin-nft-marketplace-testnet.netlify.app' : 'https://likecoin.github.io/likecoin-nft-marketplace'
