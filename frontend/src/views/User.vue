<script setup>
import { watchEffect } from 'vue'
import { useScopedI18n } from '@/i18n/app'
import { useGlobalState } from '../store'

import AddressMangement from './user/AddressManagement.vue';
import UserSettingsPage from './user/UserSettings.vue';
import UserBar from './user/UserBar.vue';
import UserMailBox from './user/UserMailBox.vue';
import UserSendBox from './user/UserSendBox.vue';

const {
    userTab, globalTabplacement, userSettings, openSettings, showUserSystem
} = useGlobalState()

const { t } = useScopedI18n('views.User')
const { t: userMailT } = useScopedI18n('views.user.UserSendBox')

watchEffect(() => {
    if (userTab.value === 'bind_address') userTab.value = 'address_management'
    if (!openSettings.value.fetched) return
    const visibleTabs = [
        'address_management', 'user_mail_box_tab',
        ...(openSettings.value.enableSendMail ? ['user_sendbox', 'user_send_mail'] : []),
        'user_settings',
    ]
    if (!visibleTabs.includes(userTab.value)) userTab.value = 'address_management'
})
</script>

<template>
    <div v-if="showUserSystem">
        <UserBar />
        <n-tabs v-if="userSettings.user_email" type="line" size="medium" v-model:value="userTab" :placement="globalTabplacement">
            <n-tab-pane name="address_management" :tab="t('address_management')"><AddressMangement /></n-tab-pane>
            <n-tab-pane name="user_mail_box_tab" :tab="t('user_mail_box_tab')"><UserMailBox /></n-tab-pane>
            <n-tab-pane v-if="openSettings.enableSendMail" name="user_sendbox" :tab="userMailT('sendbox')">
                <UserSendBox mode="sendbox" />
            </n-tab-pane>
            <n-tab-pane v-if="openSettings.enableSendMail" name="user_send_mail" :tab="t('send_mail')">
                <UserSendBox mode="send_mail" @sent="userTab = 'user_sendbox'" />
            </n-tab-pane>
            <n-tab-pane name="user_settings" :tab="t('user_settings')"><UserSettingsPage /></n-tab-pane>
        </n-tabs>
    </div>
</template>
