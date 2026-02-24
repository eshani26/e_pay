<?php
/**
 * calendar.php
 * Calendar management class and functions
 */

require_once 'config.php';

/**
 * Calendar Class for managing calendar display and date calculations
 */
class Calendar {
    private $year;
    private $month;
    private $pdo;

    public function __construct($year = null, $month = null, $pdo = null) {
        $this->year = $year ?? (int)date('Y');
        $this->month = $month ?? (int)date('m');
        $this->pdo = $pdo;

        // Validate month
        if ($this->month < 1 || $this->month > 12) {
            $this->month = (int)date('m');
        }
    }

    /**
     * Generate calendar HTML for display
     * @return string HTML calendar markup
     */
    public function generate() {
        $daysInMonth = $this->getDaysInMonth();
        $firstDay = $this->getFirstDayOfMonth();

        $html = '<div class="calendar-view">';
        $html .= $this->generateHeader();
        $html .= $this->generateWeekdays();
        $html .= $this->generateDays($daysInMonth, $firstDay);
        $html .= '</div>';

        return $html;
    }

    /**
     * Get number of days in the current month
     */
    private function getDaysInMonth() {
        return cal_days_in_month(CAL_GREGORIAN, $this->month, $this->year);
    }

    /**
     * Get the first day of the month (0-6, where 0 is Sunday)
     */
    private function getFirstDayOfMonth() {
        return date('w', strtotime("{$this->year}-{$this->month}-01"));
    }

    /**
     * Generate calendar header with month name and navigation
     */
    private function generateHeader() {
        $monthName = date('F Y', strtotime("{$this->year}-{$this->month}-01"));

        $prevMonth = $this->month - 1;
        $prevYear = $this->year;
        if ($prevMonth < 1) {
            $prevMonth = 12;
            $prevYear--;
        }

        $nextMonth = $this->month + 1;
        $nextYear = $this->year;
        if ($nextMonth > 12) {
            $nextMonth = 1;
            $nextYear++;
        }

        return "
        <div class='calendar-header'>
            <a href='?year={$prevYear}&month={$prevMonth}' class='nav-btn prev-btn'>← Previous</a>
            <h2 class='month-title'>{$monthName}</h2>
            <a href='?year={$nextYear}&month={$nextMonth}' class='nav-btn next-btn'>Next →</a>
        </div>";
    }

    /**
     * Generate weekday headers
     */
    private function generateWeekdays() {
        $weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        $html = '<div class="calendar-weekdays">';

        foreach ($weekdays as $day) {
            $dayAbbr = substr($day, 0, 3);
            $html .= "<div class='weekday-header'>{$dayAbbr}</div>";
        }

        $html .= '</div>';
        return $html;
    }

    /**
     * Generate calendar days grid
     */
    private function generateDays($daysInMonth, $firstDay) {
        $html = '<div class="calendar-days">';
        $today = date('Y-m-d');

        // Empty cells for days before month starts
        for ($i = 0; $i < $firstDay; $i++) {
            $html .= "<div class='calendar-day empty'></div>";
        }

        // Days of the month
        for ($day = 1; $day <= $daysInMonth; $day++) {
            $date = sprintf('%04d-%02d-%02d', $this->year, $this->month, $day);
            $dayOfWeek = date('w', strtotime($date));
            $isWeekend = in_array($dayOfWeek, [0, 6]);
            $isToday = ($date === $today);

            $classes = 'calendar-day';
            if ($isToday) $classes .= ' today';
            if ($isWeekend) $classes .= ' weekend';

            // Check if date has events/bookings
            $hasEvent = $this->hasBooking($date);
            if ($hasEvent) $classes .= ' has-event';

            $html .= "<div class='{$classes}' data-date='{$date}' title='{$date}'>{$day}</div>";
        }

        $html .= '</div>';
        return $html;
    }

    /**
     * Check if a date has any bookings
     */
    private function hasBooking($date) {
        if (!$this->pdo) {
            return false;
        }

        try {
            $stmt = $this->pdo->prepare("
                SELECT COUNT(*) as count FROM bookings 
                WHERE reservation_date = ? 
                AND status IN ('approved', 'pending')
            ");
            $stmt->execute([$date]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result['count'] > 0;
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Get events for a specific date from database
     */
    public static function getEvents($date, $pdo) {
        try {
            $stmt = $pdo->prepare("
                SELECT 
                    b.id,
                    b.requested_by,
                    a.name as auditorium_name,
                    b.check_in_time,
                    b.check_out_time,
                    b.nature_of_programme,
                    b.status
                FROM bookings b
                JOIN auditoriums a ON b.auditorium_id = a.id
                WHERE b.reservation_date = ? 
                AND b.status IN ('approved', 'pending')
                ORDER BY b.check_in_time ASC
            ");
            $stmt->execute([$date]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Error fetching events: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Add a new booking event
     */
    public static function addEvent($auditoriumId, $date, $checkIn, $checkOut, $requestedBy, $natureOfProgramme, $pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO bookings (
                    auditorium_id, reservation_date, check_in_time, check_out_time,
                    requested_by, nature_of_programme, status
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
            ");
            
            return $stmt->execute([
                $auditoriumId,
                $date,
                $checkIn,
                $checkOut,
                $requestedBy,
                $natureOfProgramme
            ]);
        } catch (PDOException $e) {
            error_log("Error adding event: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Get booked dates for a specific auditorium
     */
    public static function getBookedDatesForAuditorium($auditoriumId, $pdo, $fromDate = null, $toDate = null) {
        try {
            $query = "
                SELECT 
                    reservation_date as date,
                    check_in_time,
                    check_out_time,
                    requested_by,
                    nature_of_programme
                FROM bookings 
                WHERE auditorium_id = ? 
                AND status IN ('approved', 'pending')
            ";

            $params = [$auditoriumId];

            if ($fromDate) {
                $query .= " AND reservation_date >= ?";
                $params[] = $fromDate;
            }

            if ($toDate) {
                $query .= " AND reservation_date <= ?";
                $params[] = $toDate;
            }

            $query .= " ORDER BY reservation_date ASC";

            $stmt = $pdo->prepare($query);
            $stmt->execute($params);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Error fetching booked dates: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Get availability statistics for a month
     */
    public function getMonthStatistics($pdo) {
        try {
            $startDate = "{$this->year}-" . str_pad($this->month, 2, '0', STR_PAD_LEFT) . "-01";
            $endDate = date('Y-m-t', strtotime($startDate));

            $stmt = $pdo->prepare("
                SELECT 
                    COUNT(*) as total_bookings,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    COUNT(DISTINCT reservation_date) as booked_days
                FROM bookings 
                WHERE reservation_date BETWEEN ? AND ?
            ");

            $stmt->execute([$startDate, $endDate]);
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Error getting month statistics: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Get auditorium utilization for the month
     */
    public function getAuditoriumUtilization($pdo) {
        try {
            $startDate = "{$this->year}-" . str_pad($this->month, 2, '0', STR_PAD_LEFT) . "-01";
            $endDate = date('Y-m-t', strtotime($startDate));

            $stmt = $pdo->prepare("
                SELECT 
                    a.id,
                    a.name,
                    COUNT(b.id) as booking_count,
                    SUM(CASE WHEN b.status = 'approved' THEN 1 ELSE 0 END) as approved_count
                FROM auditoriums a
                LEFT JOIN bookings b ON a.id = b.auditorium_id 
                    AND b.reservation_date BETWEEN ? AND ?
                WHERE a.is_active = TRUE
                GROUP BY a.id, a.name
                ORDER BY booking_count DESC
            ");

            $stmt->execute([$startDate, $endDate]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Error getting utilization: " . $e->getMessage());
            return [];
        }
    }
}

/**
 * Helper function to get database connection
 */
function getDBConnection() {
    try {
        $database = new Database();
        return $database->getConnection();
    } catch (Exception $e) {
        error_log("Connection error: " . $e->getMessage());
        return null;
    }
}

/**
 * Helper function to format date for display
 */
function formatDateForDisplay($date) {
    try {
        $dateObj = new DateTime($date);
        return $dateObj->format('D, M d, Y');
    } catch (Exception $e) {
        return $date;
    }
}

/**
 * Helper function to check if date is in past
 */
function isDateInPast($date) {
    try {
        $dateObj = new DateTime($date);
        $today = new DateTime('today');
        return $dateObj < $today;
    } catch (Exception $e) {
        return false;
    }
}

/**
 * Helper function to get next available booking date (3 days from today)
 */
function getNextAvailableBookingDate() {
    $date = new DateTime();
    $date->add(new DateInterval('P3D')); // Add 3 days
    return $date->format('Y-m-d');
}

?>