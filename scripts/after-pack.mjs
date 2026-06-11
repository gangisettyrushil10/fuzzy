import { execSync } from 'child_process'

/**
 * electron-builder afterPack hook — strip macOS extended attributes from the
 * packaged .app bundle before codesign runs. Without this, the HFS+ resource
 * forks or Finder quarantine flags on bundled Electron binaries cause codesign
 * to fail with "resource fork, Finder information, or similar detritus not
 * allowed" when --options runtime is used.
 */
export default async function afterPack(context) {
  const { appOutDir, packager } = context
  if (packager.platform.name !== 'mac') return

  const appPath = `${appOutDir}/${packager.appInfo.productFilename}.app`
  console.log(`[afterPack] stripping extended attributes from ${appPath}`)
  execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' })
}
