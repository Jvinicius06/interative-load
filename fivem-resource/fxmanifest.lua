fx_version 'cerulean'
game      'gta5'

name        'elysius-loadscreen'
description 'ElysiusRP — Sala de espera interativa'
version     '1.0.0'

-- Loading screen nativa (carrega antes dos scripts Lua)
loadscreen 'http://SEU-IP:3000/'
loadscreen_manual_shutdown 'yes'

-- Script server-side: loga IP + identifier no Discord ao conectar
server_scripts { 'server.lua' }
