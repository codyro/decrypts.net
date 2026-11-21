<script setup>
// Ghost-envelope brand mark. The envelope inherits `currentColor` so the
// header colours it with `var(--app-accent)`; the flap line and eyes are
// real holes (via mask) that show whatever is behind.
</script>

<template>
    <svg class="logo-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
        <defs>
            <mask id="logo-mark-cutouts" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
                <rect width="64" height="64" fill="#fff" />
                <path d="M11 18 32 33 53 18" fill="none" stroke="#000" stroke-width="3.5"
                    stroke-linecap="round" stroke-linejoin="round" />
                <rect x="22" y="36" width="5" height="6" rx="1" fill="#000" />
                <rect x="37" y="36" width="5" height="6" rx="1" fill="#000" />
            </mask>
        </defs>
        <path fill="currentColor" mask="url(#logo-mark-cutouts)"
            d="M12 14h40a4 4 0 0 1 4 4v28l-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4-4 4-4-4V18a4 4 0 0 1 4-4z" />
    </svg>
</template>
