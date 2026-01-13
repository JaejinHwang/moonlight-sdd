export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-primary">
          Moonlight
        </h1>
        <p className="text-xl text-secondary max-w-md">
          AI가 논문 읽기를 도와드립니다.
          <br />
          번역, 요약, 키워드 설명을 한 곳에서.
        </p>
        <div className="pt-4">
          <p className="text-sm text-gray-500">
            프로젝트 설정 완료 - 개발 준비 완료
          </p>
        </div>
      </div>
    </main>
  );
}
