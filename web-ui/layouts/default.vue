<template>
  <div>
    <header>
      <div style="display: flex; flex-wrap:wrap; background-color:#28646e; color: white; padding: 20px;">
        <NuxtLink style="color: white; text-decoration: none;" :to="{ name: 'index' }">
          <h1>LikeCoin ISCN/NFT Tools</h1>
        </NuxtLink>
        <div style="flex: 1" />
        <WalletHeader />
      </div>
    </header>
    <div style="margin: 10px">
      <slot />
    </div>
  </div>
</template>
<style>
body {
    margin: 0;
}
table,
td,
th {
    border-collapse: collapse;
    border: 1px solid;
}

</style>
