<template>
  <div>
    <h1>List and Sell NFT</h1>
    <div v-if="error" style="color: red">
      {{ error }}
    </div>
    <div v-if="isLoading" style="color: green">
      Loading...
    </div>
    <div>Steps {{ step }} / 2</div>
    <hr>
    <section v-if="step === 1">
      <h2>1. List and Sell NFT</h2>
      <div>
        <p><label>Enter default price in LIKE (optional)</label></p>
        <input v-model="defaultPrice" type="number" placeholder="0">
        <p><label>Enter default expiration of listing (optional)</label></p>
        <input
          v-model="defaultListingExpiration"
          type="date"
          :max="maxExpirationValue"
          :min="minExpirationValue"
        >

        <p><label>Upload NFT CSV (list.csv) file: </label></p>
        <div v-if="nftSellListData?.length">
          <pre>Number of NFT data in CSV:{{ nftSellListData?.length }}</pre>
          Summary
          <table>
            <thead>
              <tr><td>Class ID</td><td>Count</td></tr>
            </thead>
            <tbody>
              <tr v-for="entry in Object.entries(nftCountObject)" :key="entry[0]">
                <td>{{ entry[0] }}</td><td>{{ entry[1] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <input type="file" @change="onListNFTFileChange">
        <br>
        <button :disabled="isLoading" style="margin-top: 16px" @click="onListNFTStart">
          Send
        </button>
      </div>
    </section>

    <section v-if="step > 1">
      <p v-if="nftResultData.transactionHash">
        Result hash: <a
          :href="`${chainExplorerURL}/${nftResultData.transactionHash}`"
          target="_blank"
          rel="noopener"
        >
          {{ nftResultData.transactionHash }}
        </a>
      </p>
      <a
        :href="`${nftMarketplaceUrl}/owned`"
        target="_blank"
        rel="noopener"
      >
        View your Listing
      </a>
    </section>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { parse } from 'csv-parse/sync'
import { formatMsgCreateListing } from '@likecoin/iscn-js/dist/messages/likenft'
import { EncodeObject } from '@cosmjs/proto-signing'
import BigNumber from 'bignumber.js'

import { CHAIN_EXPLORER_URL, NFT_MARKETPLACE_URL } from '~/constant'
import { getNFTOwner } from '~/utils/cosmos'
import { useWalletStore } from '~/stores/wallet'

const store = useWalletStore()
const { wallet, signer } = storeToRefs(store)
const { connect } = store

const step = ref(1)
const error = ref('')
const isLoading = ref(false)
const chainExplorerURL = ref(CHAIN_EXPLORER_URL)
const nftMarketplaceUrl = ref(NFT_MARKETPLACE_URL)

const defaultPrice = ref<number | undefined>(undefined)
const defaultListingExpiration = ref(new Date(Date.now() + 15552000000).toISOString().split('T')[0])
const maxExpirationValue = new Date(Date.now() + 15552000000).toISOString().split('T')[0]
const minExpirationValue = new Date(Date.now()).toISOString().split('T')[0]
const nftSellListData = ref<any[]>([])
const nftResultData = ref<any>({})

const expirationInMs = computed(() => new Date(defaultListingExpiration.value).getTime())

const nftCountObject = computed(() => {
  return nftSellListData.value.reduce((object: any, item: any) => {
    object[item.classId] = (object[item.classId] || 0) + 1
    return object
  }, {})
})

watch(isLoading, (newIsLoading) => {
  if (newIsLoading) { error.value = '' }
})

async function onListNFTStart () {
  try {
    isLoading.value = true
    if (!wallet.value || !signer.value) {
      await connect()
    }
    if (!wallet.value || !signer.value) { return }
    if (!nftSellListData.value.length) { throw new Error('NFT data not exists') }
    for (let i = 0; i < nftSellListData.value.length; i += 1) {
      const { classId, nftId } = nftSellListData.value[i]
      const { owner } = await getNFTOwner(classId, nftId)
      if (owner !== wallet.value) {
        throw new Error(`NFT classId: ${classId} nftId:${nftId} is not owned by sender!`)
      }
    }

    const signingClient = await getSigningClientWithSigner(signer.value)
    const client = signingClient.getSigningStargateClient()
    if (!client) { throw new Error('Signing client not exists') }
    step.value += 1
    const msgAnyArray: EncodeObject[] = []
    for (let i = 0; i < nftSellListData.value.length; i += 1) {
      const e = nftSellListData.value[i]
      if (!(e.price || defaultPrice.value)) {
        throw new Error(`Price not exists for NFT ${i}`)
      }
      const msgList = formatMsgCreateListing(
        wallet.value,
        e.classId,
        e.nftId,
        new BigNumber(e.price || defaultPrice.value).shiftedBy(9).toFixed(),
        (new Date(e.expiration)).getTime() || expirationInMs.value
      )
      msgAnyArray.push(msgList)
    }
    const result = await client.signAndBroadcast(
      wallet.value,
      msgAnyArray,
      getGasFee(nftSellListData.value.length)
    )
    nftResultData.value = result
  } catch (err) {
    console.error(err)
    error.value = (err as Error).toString()
  } finally {
    isLoading.value = false
  }
}

function onListNFTFileChange (event: Event) {
  if (!event?.target) { return }
  const files = (event.target as HTMLInputElement)?.files
  if (!files) { return }
  const [file] = files
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const text = e.target?.result
      if (typeof text !== 'string') { return }
      const data = parse(text, { columns: true })
      nftSellListData.value = data
      nftResultData.value = data
    } catch (err) {
      console.error(err)
      error.value = (err as Error).toString()
    }
  }
  reader.readAsText(file)
}

</script>
