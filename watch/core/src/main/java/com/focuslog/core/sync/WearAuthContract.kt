package com.focuslog.core.sync

/**
 * Contract for the phone → watch credential handoff over the Wearable Data Layer.
 *
 * The phone app writes a DataItem at [PATH_AUTH] after every successful sign-in (and on app
 * start while signed in); the watch listens for it and imports the session, so the watch never
 * needs manual credential entry. Deleting the item signals sign-out.
 *
 * Both apps MUST share the same applicationId and signing key for the Data Layer to deliver.
 */
object WearAuthContract {
    const val PATH_AUTH = "/focuslog/auth"

    const val KEY_ACCESS_TOKEN = "access_token"
    const val KEY_REFRESH_TOKEN = "refresh_token"
    const val KEY_EMAIL = "email"
    const val KEY_HANDLE = "handle"

    /** Timestamp of the write — makes each push unique so unchanged tokens still re-deliver. */
    const val KEY_UPDATED_AT = "updated_at"
}
