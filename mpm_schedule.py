import datetime

def get_mpm_books(level, grade):
    """產生 MPM 合法書號序列 (考慮跳號邏輯)"""
    ranges = {
        'GK': [(1, 40), (41, 80)],
        'GV': [(1, 24), (33, 56), (65, 88)],
        'GA': [(1, 24), (33, 56), (65, 80)]
    }
    book_list = []
    for start, end in ranges[level]:
        for i in range(start, end + 1):
            book_list.append(f"{level}{grade}{i:02d}")
    return book_list

def simulate_mpm_schedule(level, grade, no, schedule, speed, start_date_str, current_remaining_hours, end_date_str=None):
    all_books = get_mpm_books(level, grade)
    try:
        start_book=f"{level}{grade}{no}" 
        current_book_idx = all_books.index(start_book)
    except ValueError:
        return "錯誤：找不到起始書號。"

    start_date = datetime.datetime.strptime(start_date_str, "%Y/%m/%d")
    end_date = datetime.datetime.strptime(end_date_str, "%Y/%m/%d") if end_date_str else None
    weekday_names = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]
    schedule_desc = ", ".join([f"{weekday_names[k]}: {v}小時" for k, v in schedule.items()])
    
    print(f"========================================")
    print(f"      MPM 學習進度推演報告")
    print(f"========================================")
    print(f"【基本設定】")
    print(f" 學習級別：{level} 第 {grade} 年級")
    print(f" 起始書號：{start_book}")
    print(f" 每週時程：{schedule_desc}")
    print(f" 學習速度：{speed} 本/小時")
    print(f" 目前剩餘時數：{current_remaining_hours} 小時")
    print(f" 起始日期：{start_date_str}")
    print(f" 結束日期：{end_date_str if end_date_str else '無 (推演至書寫完為止)'}")
    print(f"----------------------------------------")
    print(f"【推演歷程】")

    current_date = start_date
    total_used_hours = 0
    book_progress = 0.0
    remaining_balance = current_remaining_hours
    insufficient_date = None # 紀錄開始不足的日期

    while current_book_idx < len(all_books):
        if end_date and current_date > end_date:
            break
            
        day_of_week = current_date.weekday()
        
        if day_of_week in schedule:
            hours_today = schedule[day_of_week]
            
            # --- 新增：檢查時數是否在此次課程後不足 ---
            if insufficient_date is None and remaining_balance < hours_today:
                print(f"\n---------- 時數已用盡，以下為預估進度 ----------")
                insufficient_date = current_date.strftime("%Y/%m/%d")
            
            books_to_do = hours_today * speed
            books_done_today = []
            
            temp_progress = books_to_do
            while temp_progress > 0 and current_book_idx < len(all_books):
                current_book = all_books[current_book_idx]
                if book_progress == 0.5:
                    if temp_progress >= 0.5:
                        books_done_today.append(f"{current_book}(2/2)")
                        current_book_idx += 1
                        temp_progress -= 0.5
                        book_progress = 0.0
                    else: break
                else:
                    if temp_progress >= 1.0:
                        books_done_today.append(f"{current_book}")
                        current_book_idx += 1
                        temp_progress -= 1.0
                    elif temp_progress == 0.5:
                        books_done_today.append(f"{current_book}(1/2)")
                        book_progress = 0.5
                        temp_progress = 0
                    else: break
            
            total_used_hours += hours_today
            remaining_balance -= hours_today
            
            date_display = current_date.strftime("%Y/%m/%d")
            print(f" {date_display} ({weekday_names[day_of_week]}, {hours_today}hr): {', '.join(books_done_today)}")

        current_date += datetime.timedelta(days=1)
        if current_book_idx >= len(all_books):
            print(f"\n >>> 已達該階段最後一本 ({all_books[-1]}) <<<")
            break

    print(f"----------------------------------------")
    print(f"【推演摘要】")
    print(f" 累計消耗時數：{total_used_hours} 小時")
    print(f" 最終剩餘時數：{remaining_balance} 小時")
    
    # 顯示時數不足的警示
    if insufficient_date:
        print(f" ※ 注意：時數自 {insufficient_date} 開始不足")
    else:
        print(f" ※ 狀態：目前儲值時數足以應付此段推演")
        
    print(f"========================================")

# --- 測試執行 ---
simulate_mpm_schedule(
    level="GK", 
    grade=3, 
    no=80,
    schedule={2: 2}, 
    speed=1, 
    start_date_str="2026/4/13", 
    current_remaining_hours=10
)