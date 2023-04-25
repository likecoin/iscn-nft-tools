<template>
  <div>
    <h1>Send NFT</h1>
    <div v-if="error" style="color: red">
      {{ error }}
    </div>
    <div v-if="isLoading" style="color: green">
      Loading...
    </div>
    <div>Steps {{ step }} / 1</div>
    <hr>
    <section v-if="step === 1">
      <h2>1. Send NFT</h2>
      <div>
        <p><label>Upload NFT CSV (list.csv) file: </label></p>
        <div v-if="nftSendListData?.length">
          <pre>Number of NFT data in CSV:{{ nftSendListData?.length }}</pre>
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
        <input type="file" @change="onSendNFTFileChange">
        <br>
        <button :disabled="isLoading" style="margin-top: 16px" @click="onSendNFTStart">
          Send
        </button>
      </div>
    </section>

    <section v-if="step > 1">
      Result:
      <table>
        <thead>
          <tr><td>Address</td><td>Class ID</td><td>Memo</td><td>Status</td></tr>
        </thead>
        <tbody>
          <tr v-for="entry in nftResultData" :key="entry[0]">
            <td>{{ entry.address }}</td>
            <td>{{ entry.classId }}</td>
            <td>{{ entry.memo }}</td>
            <td>{{ entry.status }}</td>
          </tr>
        </tbody>
      </table>
      <button :disabled="isLoading" @click="onDownloadCSV">
        Download NFT result csv
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { parse } from 'csv-parse/sync'
// import { stringify } from 'csv-stringify/sync'

import { getNFTs } from '~/utils/cosmos'
import { useWalletStore } from '~/stores/wallet'

const store = useWalletStore()
const { wallet, signer } = storeToRefs(store)
const { connect } = store

const step = ref(1)
const error = ref('')
const isLoading = ref(false)

const nftSendListData = ref<any>([])
const nftResultData = ref<any>([])

const nftCountObject = computed(() => {
  return nftSendListData.value.reduce((object: any, item: any) => {
    object[item.classId] = (object[item.classId] || 0) + 1
    return object
  }, {})
})

watch(isLoading, (newIsLoading) => {
  if (newIsLoading) { error.value = '' }
})

async function onSendNFTStart () {
  try {
    isLoading.value = true
    if (!wallet.value || !signer.value) {
      await connect()
    }
    if (!wallet.value || !signer.value) { return }
    if (!nftSendListData.value.length) { throw new Error('NFT data not exists') }
    const nftsDataObject: any = {}
    for (let i = 0; i < Object.keys(nftCountObject.value).length; i += 1) {
      const classId = Object.keys(nftCountObject.value)[i]
      const needCount = nftCountObject.value[classId]
      const { nfts } = await getNFTs({
        classId,
        owner: wallet.value,
        needCount
      })
      nftsDataObject[classId] = nfts
      if (needCount > nftsDataObject[classId].length) {
        throw new Error(`NFT classId: ${classId} (own quantity: ${nftsDataObject[classId].length}), Will send ${needCount} counts, NFT not enough!`)
      }
    }
  } catch (err) {
    console.error(err)
    error.value = (err as Error).toString()
  } finally {
    isLoading.value = false
  }
}

function onSendNFTFileChange (event: Event) {
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
      nftSendListData.value = data
      nftResultData.value = data
    } catch (err) {
      console.error(err)
      error.value = (err as Error).toString()
    }
  }
  reader.readAsText(file)
}

function onDownloadCSV () {
  downloadBlob(nftResultData.value, 'result.csv', 'text/csv;charset=utf-8;')
}

</script>
