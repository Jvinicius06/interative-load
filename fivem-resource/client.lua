-- Fecha o loadscreen quando o jogador terminar de carregar
-- (loadscreen_manual_shutdown = yes no fxmanifest)

AddEventHandler('onClientResourceStart', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
end)

-- Chame ShutdownLoadingScreen() quando o spawn estiver pronto.
-- Exemplo: no evento playerSpawned do seu script de spawn.
--
-- AddEventHandler('playerSpawned', function()
--     ShutdownLoadingScreen()
--     ShutdownLoadingScreenNui()
-- end)
