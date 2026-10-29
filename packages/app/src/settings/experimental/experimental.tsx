import { Component, createSignal } from "solid-js"
import { Button } from "@opencode/ui/button"
import { TextInput } from "@opencode/ui/text-input"
import { useServerSDK } from "@/runtime/server/client"
import { showToast } from "@/shell/notifications/toast"
import { useLanguage } from "@/runtime/i18n/language"
import { SettingsList } from "@/settings/list"
import { SettingsRow } from "@/settings/row"
import "@/settings/settings.css"

// Exporting a snapshot and merging another database are powerful enough operations
// to sit behind an explicit tab rather than alongside ordinary preferences.
export const experimentalSettingsAvailable = true

export const SettingsExperimental: Component = () => {
  const language = useLanguage()
  const sdk = useServerSDK()
  const [source, setSource] = createSignal("")
  const [busy, setBusy] = createSignal<"export" | "import" | undefined>()

  const failed = (title: string) => (error: unknown) => {
    showToast({
      variant: "error",
      title,
      description: error instanceof Error ? error.message : language.t("common.requestFailed"),
    })
  }

  const exportDatabase = () => {
    setBusy("export")
    void sdk.api.database
      .export({})
      .then((result) =>
        showToast({
          variant: "success",
          title: language.t("settings.experimental.database.export.toast.title"),
          description: result.path,
        }),
      )
      .catch(failed(language.t("settings.experimental.database.export.toast.error")))
      .finally(() => setBusy(undefined))
  }

  const importDatabase = () => {
    const path = source().trim()
    if (!path) return
    setBusy("import")
    void sdk.api.database
      .import({ path })
      .then((result) =>
        showToast({
          variant: "success",
          title: language.t("settings.experimental.database.import.toast.title"),
          description: language.t("settings.experimental.database.import.toast.description", {
            inserted: result.inserted,
            skipped: result.skipped,
          }),
        }),
      )
      .catch(failed(language.t("settings.experimental.database.import.toast.error")))
      .finally(() => setBusy(undefined))
  }

  return (
    <>
      <div class="settings-tab-header">
        <div class="settings-tab-header-row">
          <div class="flex flex-col gap-1">
            <h2 class="settings-tab-title">{language.t("settings.tab.experimental")}</h2>
            <span class="text-11-regular text-v2-text-text-muted">
              {language.t("settings.experimental.description")}
            </span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h3 class="settings-section-title">{language.t("settings.experimental.database.section")}</h3>
        <SettingsList>
          <SettingsRow
            title={language.t("settings.experimental.database.export.title")}
            description={language.t("settings.experimental.database.export.description")}
          >
            <div data-action="settings-database-export">
              <Button variant="ghost" size="large" disabled={busy() !== undefined} onClick={exportDatabase}>
                {language.t("settings.experimental.database.export.button")}
              </Button>
            </div>
          </SettingsRow>

          <SettingsRow
            title={language.t("settings.experimental.database.import.title")}
            description={language.t("settings.experimental.database.import.description")}
          >
            <div class="flex w-full items-center gap-2 sm:w-[340px]">
              <TextInput
                data-action="settings-database-import-path"
                type="text"
                appearance="base"
                value={source()}
                onInput={(event) => setSource(event.currentTarget.value)}
                placeholder={language.t("settings.experimental.database.import.placeholder")}
                spellcheck={false}
                autocomplete="off"
                aria-label={language.t("settings.experimental.database.import.placeholder")}
              />
              <Button
                variant="ghost"
                size="large"
                disabled={busy() !== undefined || source().trim() === ""}
                onClick={importDatabase}
              >
                {language.t("settings.experimental.database.import.button")}
              </Button>
            </div>
          </SettingsRow>
        </SettingsList>
      </div>
    </>
  )
}
