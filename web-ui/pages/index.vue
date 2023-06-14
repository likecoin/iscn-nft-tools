<template>
  <ul>
    <li>
      <NuxtLink :to="{ name: 'mint-nft' }">
        Mint NFT
      </NuxtLink>
    </li>
    <li>
      <NuxtLink :to="{ name: 'send-nft' }">
        Send NFT
      </NuxtLink>
    </li>
    <li>
      <NuxtLink :to="{ name: 'list-and-sell-nft' }">
        List and Sell NFT
      </NuxtLink>
    </li>
    <li>
      <a :href="iscnBrowserURL" target="_blank">
        ISCN Browser & Editor
      </a>
    </li>
  </ul>
</template>

<script setup>
import { ISCN_BROWSER_URL } from '~/constant'

const iscnBrowserURL = ISCN_BROWSER_URL

</script>
