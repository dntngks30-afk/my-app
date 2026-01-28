# 현재 시간을 보여주는 프로그램
import datetime

print("=" * 40)
print("현재 시간 확인 프로그램")
print("=" * 40)

# 현재 시간 가져오기
now = datetime.datetime.now()

# 시간 출력
print(f"\n현재 날짜: {now.year}년 {now.month}월 {now.day}일")
print(f"현재 시간: {now.hour}시 {now.minute}분 {now.second}초")
print(f"\n요일: {['월', '화', '수', '목', '금', '토', '일'][now.weekday()]}요일")

print("\n" + "=" * 40)
print("프로그램을 종료하려면 Enter 키를 누르세요...")
input()
