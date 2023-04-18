export function addParamToUrl (url: string, params: { [key: string]: string }) {
  const urlObject = new URL(url)
  const urlParams = new URLSearchParams(urlObject.search)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      urlParams.set(key, value)
    }
  })
  urlObject.search = urlParams.toString()
  return urlObject.toString()
}

export function downloadBlob (content: string, filename: string, contentType: string) {
  // Create a blob
  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)

  // Create a link to download it
  const pom = document.createElement('a')
  pom.href = url
  pom.setAttribute('download', filename)
  pom.click()
}
