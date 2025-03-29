<template>
  <div>
    <h1>Send NFT</h1>
    <div v-if="error" style="color: red">
      {{ error }}
    </div>
    <div v-if="isLoading" style="color: green">
      Loading...
    </div>
    <div>Steps {{ step }} / 2</div>
    <hr>
    <section v-if="step === 1">
      <h2>1. Send NFT</h2>
      <div>
        <p><label>Enter default memo (optional)</label></p>
        <input v-model="defaultMemo" placeholder="default memo">
        <p>
          <label>Upload NFT CSV (
            <a href="https://github.com/likecoin/iscn-nft-tools/blob/master/send-nft/list_example.csv" target="_blank">
              list.csv
            </a>) file: </label>
        </p>
        <div v-if="nftSendListData?.length">
          <pre>Number of NFT data in CSV:{{ nftSendListData?.length }}</pre>
          Summary
          <table>
            <thead>
              <tr>
                <td>From Address</td>
                <td>To Address</td>
                <td>Class ID</td>
                <td>Count</td>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="entry in summaryEntries"
                :key="entry.fromAddress + '-' + entry.fromAddress + '-' + entry.classId"
              >
                <td>{{ entry.fromAddress || wallet }}</td>
                <td>{{ entry.toAddress }}</td>
                <td>{{ entry.classId }}</td>
                <td>{{ entry.count }}</td>
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
          <tr>
            <td>From Address</td>
            <td>To Address</td>
            <td>Class ID</td>
            <td>NFT ID</td>
            <td>Memo</td>
            <td>Status</td>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in nftResultData" :key="entry[0]">
            <td>{{ entry.from_address || wallet }}</td>
            <td>{{ entry.to_address }}</td>
            <td>{{ entry.classId }}</td>
            <td>{{ entry.nftId }}</td>
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
import { formatMsgSend } from '@likecoin/iscn-js/dist/messages/likenft'
import { TimeoutError } from '@cosmjs/stargate'
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import { stringify } from 'csv-stringify/sync'

import { getNFTs, getNFTOwner, getSigningClientWithSigner, getGasFee } from '~/utils/cosmos'
import { useWalletStore } from '~/stores/wallet'

const store = useWalletStore()
const { wallet, signer } = storeToRefs(store)
const { connect } = store

const step = ref(1)
const error = ref('')
const isLoading = ref(false)

const defaultMemo = ref('')
const nftSendListData = ref<any>([])
const nftResultData = ref<any>([])

// 按發送地址與 ClassID 分組計數
const summaryEntries = computed(() => {
  const groupedData = nftSendListData.value.reduce((acc: any, item: any) => {
    const key = `${item.from_address || ''}-${item.classId}`
    if (!acc[key]) {
      acc[key] = {
        fromAddress: item.from_address || '',
        toAddress: item.to_address,
        classId: item.classId,
        count: 0
      }
    }
    acc[key].count += 1
    return acc
  }, {})

  return Object.values(groupedData) as any[]
})

// 按發送地址分組的 NFT 計數
const groupedByFromAddress = computed(() => {
  return nftSendListData.value.reduce((groups: any, item: any) => {
    const fromAddress = item.from_address || wallet.value
    if (!groups[fromAddress]) {
      groups[fromAddress] = []
    }
    groups[fromAddress].push(item)
    return groups
  }, {})
})

// 每個發送地址需要的 NFT 數量
const nftCountByAddress = computed(() => {
  return Object.entries(groupedByFromAddress.value).reduce((acc, [address, items]: [string, any]) => {
    acc[address] = items.reduce((object: any, item: any) => {
      object[item.classId] = (object[item.classId] || 0) + 1
      return object
    }, {})
    return acc
  }, {} as any)
})

// 每個發送地址指定的 NFT ID
const nftIdByAddress = computed(() => {
  const result: any = {}

  Object.entries(groupedByFromAddress.value).forEach(([address, items]: [string, any]) => {
    result[address] = items.reduce((object: any, item: any) => {
      if (item.nftId) {
        object[item.classId] = object[item.classId] || []
        object[item.classId].push(item.nftId)
      }
      return object
    }, {})
  })

  return result
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

    // 檢查每個發送地址的 NFT 持有量
    for (const [fromAddress, classIdObj] of Object.entries(nftCountByAddress.value)) {
      nftsDataObject[fromAddress] = {}

      for (const classId of Object.keys(classIdObj as any)) {
        const needCount = nftCountByAddress.value[fromAddress][classId]
        const { nfts } = await getNFTs({
          classId,
          owner: fromAddress,
          needCount
        })

        nftsDataObject[fromAddress][classId] = nfts

        if (needCount > nfts.length) {
          throw new Error(`NFT classId: ${classId} (owner: ${fromAddress}, quantity: ${nfts.length}), Will send ${needCount} counts, NFT not enough!`)
        }

        if (nftIdByAddress.value[fromAddress]?.[classId]) {
          for (let j = 0; j < nftIdByAddress.value[fromAddress][classId].length; j += 1) {
            const nftId = nftIdByAddress.value[fromAddress][classId][j]
            const { owner } = await getNFTOwner(classId, nftId)
            if (owner !== fromAddress) {
              throw new Error(`NFT classId: ${classId} nftId:${nftId} is not owned by ${fromAddress}!`)
            }
          }

          // 過濾掉已指定 ID 的 NFT
          nftsDataObject[fromAddress][classId] = nftsDataObject[fromAddress][classId]
            .filter((nft: any) => !nftIdByAddress.value[fromAddress][classId].includes(nft.id))
        }
      }
    }

    const signingClient = await getSigningClientWithSigner(signer.value)
    const client = signingClient.getSigningStargateClient()
    if (!client) { throw new Error('Signing client not exists') }

    const hasCsvMemo = nftSendListData.value.some((e: any) => e.memo)

    const { accountNumber, sequence } = await client.getSequence(wallet.value)
    const chainId = await client.getChainId()

    step.value += 1
    const msgAnyArray = []
    let currentSequence = sequence

    for (let i = 0; i < nftSendListData.value.length; i += 1) {
      const e = nftSendListData.value[i]
      const fromAddress = e.from_address || wallet.value

      let targetNftId = e.nftId
      if (!targetNftId) {
        const removed = nftsDataObject[fromAddress][e.classId].splice(0, 1)
        targetNftId = removed[0].id
      }

      nftResultData.value[i].nftId = targetNftId

      let msgSend
      if (fromAddress !== wallet.value) {
        // 如果 from_address 不是當前錢包地址，使用 authz 執行
        msgSend = {
          typeUrl: '/cosmos.authz.v1beta1.MsgExec',
          value: {
            grantee: wallet.value,
            msgs: [{
              typeUrl: '/cosmos.nft.v1beta1.MsgSend',
              value: formatMsgSend(
                fromAddress,
                e.to_address,
                e.classId,
                targetNftId
              )
            }]
          }
        }
      } else {
        // 如果 from_address 是當前錢包地址或未設定，使用原本的 formatMsgSend
        msgSend = formatMsgSend(
          fromAddress,
          e.to_address,
          e.classId,
          targetNftId
        )
      }

      if (hasCsvMemo) {
        const tx = await client.sign(
          wallet.value,
          [msgSend],
          getGasFee(1),
          e.memo || defaultMemo.value,
          {
            accountNumber,
            sequence: currentSequence,
            chainId
          }
        )
        nftResultData.value[i].status = 'signed'
        currentSequence += 1
        try {
          const txBytes = TxRaw.encode(tx).finish()
          const res = await client.broadcastTx(txBytes, 1000, 1000)
          nftResultData.value[i].status = `broadcasted ${res.transactionHash}`
        } catch (err) {
          if (err instanceof TimeoutError) {
            nftResultData.value[i].status = `broadcasted ${err.txId}`
          } else {
            nftResultData.value[i].status = `error ${(err as Error).toString()}`
            throw err
          }
        }
      } else {
        msgAnyArray.push(msgSend)
      }
    }

    if (msgAnyArray.length) {
      const result = await client.signAndBroadcast(
        wallet.value,
        msgAnyArray,
        getGasFee(nftSendListData.value.length),
        defaultMemo.value
      )
      for (let i = 0; i < nftSendListData.value.length; i += 1) {
        nftResultData.value[i].status = `broadcasted ${result.transactionHash}`
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
  downloadBlob(stringify(nftResultData.value), 'result.csv', 'text/csv;charset=utf-8;')
}

</script>
