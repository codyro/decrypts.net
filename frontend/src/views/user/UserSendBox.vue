<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useScopedI18n } from '@/i18n/app'

import { api } from '../../api'
import { useGlobalState } from '../../store'
import SendBox from '../../components/SendBox.vue'
import { SendRound } from '@vicons/material'

const SendMail = defineAsyncComponent(() => import('./SendMail.vue'))

const ADDRESS_PAGE_SIZE = 100

const props = defineProps({
    mode: {
        type: String,
        default: 'send_mail',
    },
})

const emit = defineEmits(['sent'])

const message = useMessage()
const { openSettings } = useGlobalState()
const { t } = useScopedI18n('views.user.UserSendBox')
const { t: mailboxT } = useScopedI18n('views.user.UserMailBox')

const selectedAddressId = ref(null)
const addressFilter = ref(null)
const addressOptions = ref([])
const addressCount = ref(0)
const addressLoading = ref(false)
const sendboxKey = ref(0)

const hasMoreAddresses = computed(() => addressOptions.value.length < addressCount.value)
const addressFilterOptions = computed(() => addressOptions.value.map((address) => ({
    label: address.label,
    value: address.address,
})))

const fetchAddresses = async () => {
    if (addressLoading.value || (!hasMoreAddresses.value && addressOptions.value.length > 0)) {
        return
    }
    addressLoading.value = true
    try {
        const offset = addressOptions.value.length
        const { results, count } = await api.fetch(
            `/user_api/bind_address?limit=${ADDRESS_PAGE_SIZE}&offset=${offset}`
        )
        addressOptions.value.push(...results.map((address) => ({
            label: address.name,
            value: address.id,
            address: address.name,
        })))
        if (offset === 0) {
            addressCount.value = count
        }
        if (props.mode === 'send_mail' && !selectedAddressId.value && addressOptions.value.length > 0) {
            selectedAddressId.value = addressOptions.value[0].value
        }
    } catch (error) {
        message.error(error.message || 'error')
    } finally {
        addressLoading.value = false
    }
}

const handleAddressScroll = async (event) => {
    const target = event.currentTarget
    if (!target || target.scrollTop + target.clientHeight < target.scrollHeight - 24) {
        return
    }
    await fetchAddresses()
}

const fetchSendbox = async (limit, offset) => {
    return await api.fetch(
        `/user_api/sendbox?limit=${limit}&offset=${offset}`
        + (addressFilter.value ? `&address=${encodeURIComponent(addressFilter.value)}` : '')
    )
}

const deleteSendboxMail = async (mailId) => {
    await api.fetch(`/user_api/sendbox/${mailId}`, { method: 'DELETE' })
}

const querySendbox = () => {
    sendboxKey.value = Date.now()
}

watch(addressFilter, querySendbox)

onMounted(fetchAddresses)
</script>

<template>
    <div class="user-send-box">
        <template v-if="mode === 'send_mail'">
            <div v-if="!selectedAddressId" class="empty-state">
                <n-icon class="empty-state__icon" :component="SendRound" />
                <h3 class="empty-state__title">{{ t('noAddress') }}</h3>
            </div>
            <SendMail v-else :key="selectedAddressId" v-model:address-id="selectedAddressId"
                :address-options="addressOptions" :address-loading="addressLoading"
                @address-scroll="handleAddressScroll" @sent="emit('sent')" />
        </template>
        <template v-else>
            <div class="toolbar user-address-filter">
                <n-input-group class="user-address-filter__group">
                    <n-select v-model:value="addressFilter" :options="addressFilterOptions" clearable
                        :loading="addressLoading" :placeholder="mailboxT('addressQueryTip')"
                        @scroll="handleAddressScroll" />
                    <n-button @click="querySendbox" secondary>{{ mailboxT('query') }}</n-button>
                </n-input-group>
            </div>
            <SendBox :key="sendboxKey" :fetch-mail-data="fetchSendbox" show-e-mail-from
                :enable-user-delete-email="openSettings.enableUserDeleteEmail"
                :delete-mail="deleteSendboxMail" />
        </template>
    </div>
</template>

<style scoped>
.user-send-box { text-align: left; }
.user-address-filter { margin-bottom: var(--space-3); }
.user-address-filter__group { flex: 1 1 320px; max-width: 480px; }

</style>
