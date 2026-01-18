import { loadConfig } from './config.js';

type MessageKey = 
  | 'sync.start'
  | 'sync.noSources'
  | 'sync.noSourcesHint'
  | 'sync.syncing'
  | 'sync.fetching'
  | 'sync.classifying'
  | 'sync.channelResult'
  | 'sync.channelFailed'
  | 'sync.summary'
  | 'sync.totalLinks'
  | 'sync.newArticles'
  | 'sync.alreadySaved'
  | 'sync.filteredOut'
  | 'sync.generateHint'
  | 'sync.noLinksHint'
  | 'clear.confirm'
  | 'clear.cancelled'
  | 'clear.success'
  | 'init.welcome'
  | 'init.selectProvider'
  | 'init.enterApiKey'
  | 'init.fetchingModels'
  | 'init.foundModels'
  | 'init.selectModel'
  | 'init.enterModelId'
  | 'init.selectLanguage'
  | 'init.enterLanguage'
  | 'init.selectOutputFormat'
  | 'init.configSaved'
  | 'init.nextSteps'
  | 'generate.processingSummary'
  | 'generate.processed'
  | 'generate.articleStats'
  | 'generate.total'
  | 'generate.ready'
  | 'generate.pending'
  | 'generate.magazineGenerated'
  | 'generate.serveHint'
  | 'generate.noArticles';

const messages: Record<string, Record<MessageKey, string>> = {
  English: {
    'sync.start': 'Syncing articles...',
    'sync.noSources': 'No Slack sources configured.',
    'sync.noSourcesHint': 'Add one with: linkpress source add slack',
    'sync.syncing': 'Syncing: {workspace}',
    'sync.fetching': 'Fetching from {channel}...',
    'sync.classifying': '{channel}: Classifying links ({current}/{total})...',
    'sync.channelResult': '{channel}: {total} links, {new} new, {existing} existing, {filtered} filtered',
    'sync.channelFailed': '{channel}: Failed to fetch',
    'sync.summary': 'Sync Summary',
    'sync.totalLinks': 'Total links found: {count}',
    'sync.newArticles': 'New articles: {count}',
    'sync.alreadySaved': 'Already saved: {count}',
    'sync.filteredOut': 'Filtered out: {count}',
    'sync.generateHint': 'Run "linkpress generate" to create your magazine.',
    'sync.noLinksHint': 'No links found. Try adding more channels or URLs manually.',
    'clear.confirm': 'Are you sure you want to delete all articles?',
    'clear.cancelled': 'Cancelled.',
    'clear.success': 'Cleared {count} articles.',
    'init.welcome': 'Welcome to LinkPress!',
    'init.selectProvider': 'Select your AI provider:',
    'init.enterApiKey': 'Enter your {provider} API key:',
    'init.fetchingModels': 'Fetching available models...',
    'init.foundModels': 'Found {count} models',
    'init.selectModel': 'Select model:',
    'init.enterModelId': 'Enter model ID:',
    'init.selectLanguage': 'Select your preferred language for summaries:',
    'init.enterLanguage': 'Enter language name:',
    'init.selectOutputFormat': 'Select output format:',
    'init.configSaved': 'Configuration saved to',
    'init.nextSteps': 'Next steps:',
    'generate.processingSummary': 'Processing Summary',
    'generate.processed': 'Processed: {count}',
    'generate.articleStats': 'Article Stats',
    'generate.total': 'Total: {count}',
    'generate.ready': 'Ready: {count}',
    'generate.pending': 'Pending: {count}',
    'generate.magazineGenerated': 'Magazine Generated!',
    'generate.serveHint': 'Run "linkpress serve" to view your magazine.',
    'generate.noArticles': 'No processed articles yet. Run without --skip-process first.',
  },
  '한국어': {
    'sync.start': '아티클 동기화 중...',
    'sync.noSources': 'Slack 소스가 설정되지 않았습니다.',
    'sync.noSourcesHint': '다음 명령어로 추가하세요: linkpress source add slack',
    'sync.syncing': '동기화 중: {workspace}',
    'sync.fetching': '{channel}에서 가져오는 중...',
    'sync.classifying': '{channel}: 링크 분류 중 ({current}/{total})...',
    'sync.channelResult': '{channel}: {total}개 링크, {new}개 신규, {existing}개 기존, {filtered}개 필터링',
    'sync.channelFailed': '{channel}: 가져오기 실패',
    'sync.summary': '동기화 요약',
    'sync.totalLinks': '총 링크 수: {count}',
    'sync.newArticles': '신규 아티클: {count}',
    'sync.alreadySaved': '이미 저장됨: {count}',
    'sync.filteredOut': '필터링됨: {count}',
    'sync.generateHint': '"linkpress generate" 명령어로 매거진을 생성하세요.',
    'sync.noLinksHint': '링크가 없습니다. 채널을 추가하거나 URL을 직접 추가해보세요.',
    'clear.confirm': '모든 아티클을 삭제하시겠습니까?',
    'clear.cancelled': '취소되었습니다.',
    'clear.success': '{count}개의 아티클이 삭제되었습니다.',
    'init.welcome': 'LinkPress에 오신 것을 환영합니다!',
    'init.selectProvider': 'AI 프로바이더를 선택하세요:',
    'init.enterApiKey': '{provider} API 키를 입력하세요:',
    'init.fetchingModels': '사용 가능한 모델 조회 중...',
    'init.foundModels': '{count}개의 모델을 찾았습니다',
    'init.selectModel': '모델을 선택하세요:',
    'init.enterModelId': '모델 ID를 입력하세요:',
    'init.selectLanguage': '요약에 사용할 언어를 선택하세요:',
    'init.enterLanguage': '언어 이름을 입력하세요:',
    'init.selectOutputFormat': '출력 형식을 선택하세요:',
    'init.configSaved': '설정이 저장되었습니다:',
    'init.nextSteps': '다음 단계:',
    'generate.processingSummary': '처리 요약',
    'generate.processed': '처리됨: {count}',
    'generate.articleStats': '아티클 현황',
    'generate.total': '전체: {count}',
    'generate.ready': '준비됨: {count}',
    'generate.pending': '대기중: {count}',
    'generate.magazineGenerated': '매거진 생성 완료!',
    'generate.serveHint': '"linkpress serve" 명령어로 매거진을 확인하세요.',
    'generate.noArticles': '처리된 아티클이 없습니다. --skip-process 옵션 없이 실행하세요.',
  },
  '日本語': {
    'sync.start': '記事を同期中...',
    'sync.noSources': 'Slackソースが設定されていません。',
    'sync.noSourcesHint': '次のコマンドで追加してください: linkpress source add slack',
    'sync.syncing': '同期中: {workspace}',
    'sync.fetching': '{channel}から取得中...',
    'sync.classifying': '{channel}: リンクを分類中 ({current}/{total})...',
    'sync.channelResult': '{channel}: {total}件のリンク, {new}件の新規, {existing}件の既存, {filtered}件のフィルタ',
    'sync.channelFailed': '{channel}: 取得に失敗しました',
    'sync.summary': '同期サマリー',
    'sync.totalLinks': '合計リンク数: {count}',
    'sync.newArticles': '新規記事: {count}',
    'sync.alreadySaved': '保存済み: {count}',
    'sync.filteredOut': 'フィルタ済み: {count}',
    'sync.generateHint': '"linkpress generate"でマガジンを作成してください。',
    'sync.noLinksHint': 'リンクが見つかりません。チャンネルを追加するか、URLを手動で追加してください。',
    'clear.confirm': 'すべての記事を削除しますか？',
    'clear.cancelled': 'キャンセルしました。',
    'clear.success': '{count}件の記事を削除しました。',
    'init.welcome': 'LinkPressへようこそ！',
    'init.selectProvider': 'AIプロバイダーを選択:',
    'init.enterApiKey': '{provider} APIキーを入力:',
    'init.fetchingModels': '利用可能なモデルを取得中...',
    'init.foundModels': '{count}個のモデルが見つかりました',
    'init.selectModel': 'モデルを選択:',
    'init.enterModelId': 'モデルIDを入力:',
    'init.selectLanguage': '要約に使用する言語を選択:',
    'init.enterLanguage': '言語名を入力:',
    'init.selectOutputFormat': '出力形式を選択:',
    'init.configSaved': '設定が保存されました:',
    'init.nextSteps': '次のステップ:',
    'generate.processingSummary': '処理サマリー',
    'generate.processed': '処理済み: {count}',
    'generate.articleStats': '記事ステータス',
    'generate.total': '合計: {count}',
    'generate.ready': '準備完了: {count}',
    'generate.pending': '保留中: {count}',
    'generate.magazineGenerated': 'マガジンが生成されました！',
    'generate.serveHint': '"linkpress serve"でマガジンを確認してください。',
    'generate.noArticles': '処理済みの記事がありません。--skip-processなしで実行してください。',
  },
};

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const config = loadConfig();
  const lang = config.ai.language || 'English';
  
  const langMessages = messages[lang] || messages['English'];
  let message = langMessages[key] || messages['English'][key] || key;
  
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      message = message.replace(`{${k}}`, String(v));
    }
  }
  
  return message;
}
