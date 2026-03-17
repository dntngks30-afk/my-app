# Korean Voice Cue Clips (PR D)

이 폴더에는 카메라 촬영 시 음성 가이드용 한국어 사전 녹음 클립을 배치합니다.

## 지원 clip 키 (MVP)

| 파일명 | 용도 |
|--------|------|
| start_capture.mp3 | 촬영 시작 안내 |
| countdown_3.mp3 | 카운트다운 3 |
| countdown_2.mp3 | 카운트다운 2 |
| countdown_1.mp3 | 카운트다운 1 |
| framing_full_body.mp3 | 머리부터 발끝까지 보이게 해주세요 |
| framing_step_back.mp3 | 조금 뒤로 가 주세요 |
| framing_center_body.mp3 | 전신이 화면에 들어오게 맞춰주세요 |
| move_slowly.mp3 | 카메라를 고정하고 천천히 움직여주세요 |
| squat_go_deeper.mp3 | 조금 더 깊게 앉아주세요 |
| overhead_raise_higher.mp3 | 양팔을 머리 위로 끝까지 올려주세요 |
| overhead_hold_top.mp3 | 맨 위에서 잠깐 멈춰주세요 |
| good_job.mp3 | 좋아요 (성공) |
| success.mp3 | (good_job과 동일, 별칭) |

## 동작

- 클립이 있으면 사전 녹음 재생
- 클립이 없거나 재생 실패 시 speech synthesis로 fallback
- 클립 추가/교체 시 이 경로에 mp3 파일을 넣으면 자동 적용
