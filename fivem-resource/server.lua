-- ElysiusRP — Log de conexão na sala de espera
-- Registra IP + identifier + nome do jogador no Discord quando ele entra.

local WAITING_ROOM_URL = 'http://SEU-IP:3000'
local SERVER_SECRET    = 'troque-por-um-segredo-seguro' -- mesmo valor de SERVER_SECRET no .env

AddEventHandler('playerConnecting', function(playerName, setKickReason, deferrals)
    local src = source

    local identifier = GetPlayerIdentifier(src, 0) or ('unknown:' .. tostring(src))
    local ip         = GetPlayerEndpoint(src) or 'desconhecido'

    PerformHttpRequest(
        WAITING_ROOM_URL .. '/api/player-log',
        function(status, body, headers) end, -- resposta ignorada
        'POST',
        json.encode({
            fivemName  = playerName or 'Desconhecido',
            identifier = identifier,
            ip         = ip,
        }),
        {
            ['Content-Type']    = 'application/json',
            ['x-server-secret'] = SERVER_SECRET,
        }
    )
end)
