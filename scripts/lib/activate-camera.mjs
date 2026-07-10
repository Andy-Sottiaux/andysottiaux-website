export async function activateCamera(page, cameraName) {
  const tab = page.getByRole('tab', { name: cameraName, exact: true })
  if (await tab.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
    await tab.click()
  }

  const play = page.getByRole('button', { name: `Play ${cameraName} live stream`, exact: true })
  if (await play.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
    await play.click()
  }
}
