<script setup>
import { useScopedI18n } from '@/i18n/app'
import { useIsMobile } from '../utils/composables'
import { useGlobalState } from '../store'
import Appearance from '../views/common/Appearance.vue'

defineProps({
    show: { type: Boolean, default: false },
    isHomeRoute: { type: Boolean, default: false },
})
const emit = defineEmits(['update:show'])
const isMobile = useIsMobile()
const { settings } = useGlobalState()
const { t } = useScopedI18n('views.Header')
</script>

<template>
    <n-drawer :show="show" @update:show="emit('update:show', $event)" placement="right"
        :width="isMobile ? '100%' : 420">
        <n-drawer-content :title="t('preferences')" closable>
            <Appearance :showUseSimpleIndex="isHomeRoute && !!settings.address" />
        </n-drawer-content>
    </n-drawer>
</template>
