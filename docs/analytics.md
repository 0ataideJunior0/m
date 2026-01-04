Implementação de Vercel Web Analytics

1. Habilitar Analytics no projeto Vercel
- No Dashboard, acesse seu projeto e habilite a aba Analytics.
- Após o próximo deploy, rotas /_vercel/insights/* serão adicionadas.

2. Inclusão do script
- index.html inclui a inicialização de window.va e o script de rastreamento:
  - <script> window.va = window.va || function(){ (window.vaq = window.vaq || []).push(arguments) } </script>
  - <script defer src="/_vercel/insights/script.js"></script>

3. Eventos customizados
- Utilitário em src/utils/analytics.ts expõe trackEvent(name, data?) que chama window.va('event', { name, data }).
- Exemplos:
  - Home: StartWorkout com { day }
  - Profile: DayCompleted ao aumentar dias concluídos; ShareAchievements ao compartilhar.

4. Desenvolvimento e Produção
- O script reporta no ambiente Vercel (produção); localmente não coleta.
- Valide no Dashboard (Analytics) após visitas em produção.

5. Privacidade e desempenho
- Web Analytics é first-party, sem cookies e leve.
- Não armazenar PII em eventos; usar chaves simples em data.

