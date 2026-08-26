# 불타는 바둑 (Baduk Fire)

19x19 바둑판, 온라인(방코드) / 오프라인(한 화면 맞대결) 대국이 가능한 웹사이트입니다.
정식 규칙(따내기, 자충수 금지, 패/동형반복 금지)과 종국 시 자동 집계산(중국식 area scoring, 덤 6.5집)을 지원합니다.

## 폴더 구조

```
baduk-fire/
├── server.js          # Express + Socket.io 서버 (방 관리, 온라인 대국 로직)
├── gameLogic.js        # 바둑 규칙 엔진 (서버용)
├── package.json
└── public/
    ├── index.html       # 화면 4개(시작/온라인/오프라인/게임) + 결과 모달
    ├── style.css        # 불 테마 디자인
    ├── client.js         # 화면 전환, 소켓 통신, 캔버스 렌더링, 오프라인 규칙 엔진(클라이언트 복제본)
    └── images/
        ├── black.png    # ← 여기에 흑돌 이미지를 넣으세요 (직접 준비한 파일)
        └── white.png    # ← 여기에 백돌 이미지를 넣으세요
```

> **바둑알 이미지**: `public/images/black.png`, `public/images/white.png` 파일을 넣으면 자동으로 그 이미지로 돌이 그려집니다.
> 파일이 없으면 임시로 원형 그라디언트 돌이 대신 그려지므로, 이미지 없이도 바로 실행/배포가 가능합니다.

## 로컬 실행

```bash
npm install
npm start
```

브라우저에서 `http://localhost:3000` 접속.

## GitHub에 올리기

1. GitHub에서 새 저장소를 만듭니다 (예: `baduk-fire`).
2. 이 폴더에서:
   ```bash
   git init
   git add .
   git commit -m "불타는 바둑 초기 버전"
   git branch -M main
   git remote add origin https://github.com/<본인계정>/baduk-fire.git
   git push -u origin main
   ```

## Render에 배포하기

1. [render.com](https://render.com) 로그인 후 **New + → Web Service** 선택
2. 방금 만든 GitHub 저장소 연결
3. 설정값:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free로 시작 가능
4. Create Web Service 클릭 → 몇 분 후 `https://your-app.onrender.com` 주소로 접속 가능

> Render 무료 플랜은 일정 시간 트래픽이 없으면 서버가 슬립 상태가 되어, 첫 접속 시 로딩이 몇 초 걸릴 수 있습니다.
> 온라인 대국은 소켓 연결이 유지되어야 하므로, 무료 플랜에서 오래 자리를 비우면 재접속이 필요할 수 있습니다.

## 게임 흐름 요약

- **시작 화면**: 이름 입력 → 온라인 / 오프라인 선택
- **온라인**:
  - 방 만들기 → 7자리 숫자 코드 발급 (방 만든 사람 = 흑돌, 항상 선공)
  - 입장하기 → 코드 입력 → 백돌로 입장, 자동으로 대국 시작
- **오프라인**: 같은 화면에서 흑/백 이름을 각각 입력하고 번갈아 클릭해서 진행
- **대국 중**: 패스(연속 2회 시 종국 + 자동 집계산), 기권 가능
- **판정**: 중국식 area scoring (돌 수 + 집 수, 백 덤 6.5집)

## 알려진 단순화 사항

- 사석(죽은 돌) 표시 기능은 없습니다. 종국 시 보드에 남아있는 돌은 모두 "살아있는 돌"로 간주하고 집계산합니다.
  실전에서는 완전히 잡을 때까지 두거나, 서로 합의 후 패스하는 방식으로 사용하세요.
- 패(ko) 규칙은 "이전에 나왔던 판 모양 전체가 다시 나오면 금지"하는 동형반복 금지 방식으로 구현되어 있어 실제 한 수 패보다 약간 더 엄격합니다.
- 온라인 방은 참가자 두 명 중 한 명이 접속을 끊으면 방이 사라집니다(재접속 기능 없음).
