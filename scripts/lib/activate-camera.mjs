export async function activateCamera(page, cameraName) {
  const tab = page.getByRole('tab', { name: cameraName, exact: true })
  if (await tab.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
    await tab.click()
  }

  const unlock = page.getByRole('button', { name: `Unlock ${cameraName} live stream`, exact: true })
  if (await unlock.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
    await unlock.click()
    const dialog = page.getByRole('dialog', { name: 'Camera & device access' })
    if (await dialog.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
      const password = process.env.CAMERA_ACCESS_PASSWORD || ''
      if (!password) {
        throw new Error('CAMERA_ACCESS_PASSWORD is required for private camera verification')
      }
      await dialog.getByLabel('Access password').fill(password)
      await dialog.getByRole('button', { name: 'Unlock', exact: true }).click()
      await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
    }
  }

  const play = page.getByRole('button', { name: `Play ${cameraName} live stream`, exact: true })
  if (await play.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
    await play.click()
  }
}
