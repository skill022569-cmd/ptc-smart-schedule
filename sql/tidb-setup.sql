-- PTC Smart Schedule: สร้างตาราง + ข้อมูลตัวอย่าง (demo)
-- วางทั้งไฟล์ใน TiDB Cloud SQL Editor แล้วกด Run
CREATE DATABASE IF NOT EXISTS ptc_schedule;
USE ptc_schedule;
SET FOREIGN_KEY_CHECKS = 0;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'TEACHER', 'STUDENT') NOT NULL,
    `department` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `pdpaConsentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_role_department_idx`(`role`, `department`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teachers_constraints` (
    `teacherId` INTEGER NOT NULL,
    `maxHoursPerWeek` INTEGER NOT NULL DEFAULT 24,
    `unavailableSlots` JSON NOT NULL,
    `preferredTime` VARCHAR(191) NOT NULL DEFAULT 'ANY',

    PRIMARY KEY (`teacherId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `student_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `isDualVocational` BOOLEAN NOT NULL DEFAULT false,
    `studyDays` JSON NOT NULL,

    UNIQUE INDEX `student_groups_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentCode` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `groupId` INTEGER NOT NULL,
    `isDualVocational` BOOLEAN NOT NULL DEFAULT false,
    `userId` INTEGER NULL,

    UNIQUE INDEX `students_studentCode_key`(`studentCode`),
    UNIQUE INDEX `students_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `theoryHours` INTEGER NOT NULL,
    `practiceHours` INTEGER NOT NULL,
    `requiredRoomType` VARCHAR(191) NULL,

    UNIQUE INDEX `subjects_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rooms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `capacity` INTEGER NOT NULL,
    `roomType` VARCHAR(191) NOT NULL,
    `building` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `rooms_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subjectId` INTEGER NOT NULL,
    `teacherId` INTEGER NOT NULL,
    `groupId` INTEGER NULL,
    `studentId` INTEGER NULL,
    `allowSplit` BOOLEAN NOT NULL DEFAULT false,

    INDEX `enrollments_teacherId_idx`(`teacherId`),
    INDEX `enrollments_groupId_idx`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `timeslots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dayOfWeek` INTEGER NOT NULL,
    `periodNo` INTEGER NOT NULL,
    `startTime` VARCHAR(191) NOT NULL,
    `endTime` VARCHAR(191) NOT NULL,
    `isLunchBreak` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `timeslots_dayOfWeek_periodNo_key`(`dayOfWeek`, `periodNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `semester` VARCHAR(191) NOT NULL,
    `enrollmentId` INTEGER NOT NULL,
    `roomId` INTEGER NULL,
    `slotId` INTEGER NULL,
    `status` ENUM('VALID', 'CONFLICT') NOT NULL DEFAULT 'VALID',
    `conflictReason` TEXT NULL,

    INDEX `schedules_semester_status_idx`(`semester`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `issue_reports` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reporterId` INTEGER NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'PENDING',
    `adminReply` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_backups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `backupName` VARCHAR(191) NOT NULL,
    `snapshotData` JSON NOT NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pdpa_consent_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pdpa_consent_logs_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `teachers_constraints` ADD CONSTRAINT `teachers_constraints_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `student_groups`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `students` ADD CONSTRAINT `students_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `student_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `students`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_slotId_fkey` FOREIGN KEY (`slotId`) REFERENCES `timeslots`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `issue_reports` ADD CONSTRAINT `issue_reports_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_backups` ADD CONSTRAINT `system_backups_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pdpa_consent_logs` ADD CONSTRAINT `pdpa_consent_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


/*M!999999\- enable the sandbox mode */ 
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (1,5,5,1,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (2,6,6,1,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (3,7,7,1,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (4,8,8,1,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (5,9,7,1,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (6,10,5,1,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (7,2,2,1,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (8,3,3,1,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (9,11,6,2,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (10,12,8,2,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (11,13,5,2,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (12,14,7,2,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (13,15,6,2,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (14,16,8,2,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (15,3,4,2,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (16,4,2,2,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (17,17,5,3,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (18,18,7,3,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (19,19,8,3,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (20,20,6,3,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (21,21,5,3,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (22,22,8,3,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (23,4,3,3,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (24,1,4,3,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (25,23,7,4,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (26,24,6,4,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (27,25,8,4,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (28,26,5,4,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (29,29,9,5,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (30,30,10,5,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (31,31,11,5,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (32,32,12,5,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (33,33,11,5,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (34,34,9,5,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (35,2,2,5,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (36,3,3,5,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (37,35,10,6,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (38,36,12,6,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (39,37,9,6,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (40,38,11,6,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (41,39,10,6,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (42,40,12,6,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (43,3,4,6,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (44,4,2,6,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (45,41,9,7,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (46,42,11,7,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (47,43,12,7,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (48,44,10,7,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (49,45,9,7,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (50,46,12,7,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (51,4,3,7,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (52,1,4,7,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (53,47,11,8,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (54,48,10,8,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (55,49,12,8,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (56,50,9,8,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (57,53,13,3,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (58,54,14,3,NULL,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (59,3,2,NULL,61,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (60,1,3,NULL,62,0);
INSERT INTO `enrollments` (`id`, `subjectId`, `teacherId`, `groupId`, `studentId`, `allowSplit`) VALUES (61,4,4,NULL,63,0);
INSERT INTO `rooms` (`id`, `code`, `name`, `capacity`, `roomType`, `building`) VALUES (1,'COMPUTER-01','ห้องปฏิบัติการคอมพิวเตอร์ COMPUTER 1',40,'COMPUTER','อาคาร 2');
INSERT INTO `rooms` (`id`, `code`, `name`, `capacity`, `roomType`, `building`) VALUES (2,'COMPUTER-02','ห้องปฏิบัติการคอมพิวเตอร์ COMPUTER 2',40,'COMPUTER','อาคาร 3');
INSERT INTO `rooms` (`id`, `code`, `name`, `capacity`, `roomType`, `building`) VALUES (3,'COMPUTER-03','ห้องปฏิบัติการคอมพิวเตอร์ COMPUTER 3',40,'COMPUTER','อาคาร 4');
INSERT INTO `rooms` (`id`, `code`, `name`, `capacity`, `roomType`, `building`) VALUES (4,'COMPUTER-04','ห้องปฏิบัติการคอมพิวเตอร์ COMPUTER 4',40,'COMPUTER','อาคาร 1');
INSERT INTO `rooms` (`id`, `code`, `name`, `capacity`, `roomType`, `building`) VALUES (5,'COMPUTER-05','ห้องปฏิบัติการคอมพิวเตอร์ COMPUTER 5',40,'COMPUTER','อาคาร 2');
INSERT INTO `rooms` (`id`, `code`, `name`, `capacity`, `roomType`, `building`) VALUES (6,'COMPUTER-06','ห้องปฏิบัติการคอมพิวเตอร์ COMPUTER 6',40,'COMPUTER','อาคาร 3');
INSERT INTO `rooms` (`id`, `code`, `name`, `capacity`, `roomType`, `building`) VALUES (7,'COMPUTER-07','ห้องปฏิบัติการคอมพิวเตอร์ COMPUTER 7',40,'COMPUTER','อาคาร 4');
INSERT INTO `rooms` (`id`, `code`, `name`, `capacity`, `roomType`, `building`) VALUES (8,'LECTURE-01','ห้องเรียน LECTURE 1',40,'LECTURE','อาคาร 2');
INSERT INTO `rooms` (`id`, `code`, `name`, `capacity`, `roomType`, `building`) VALUES (9,'LECTURE-02','ห้องเรียน LECTURE 2',40,'LECTURE','อาคาร 3');
INSERT INTO `rooms` (`id`, `code`, `name`, `capacity`, `roomType`, `building`) VALUES (10,'LECTURE-03','ห้องเรียน LECTURE 3',40,'LECTURE','อาคาร 4');
INSERT INTO `student_groups` (`id`, `code`, `name`, `level`, `department`, `isDualVocational`, `studyDays`) VALUES (1,'G001','ปวช.1/1 คอมพิวเตอร์ธุรกิจ','ปวช.','คอมพิวเตอร์ธุรกิจ',0,'[1,2,3,4,5]');
INSERT INTO `student_groups` (`id`, `code`, `name`, `level`, `department`, `isDualVocational`, `studyDays`) VALUES (2,'G002','ปวช.1/2 คอมพิวเตอร์ธุรกิจ','ปวช.','คอมพิวเตอร์ธุรกิจ',0,'[1,2,3,4,5]');
INSERT INTO `student_groups` (`id`, `code`, `name`, `level`, `department`, `isDualVocational`, `studyDays`) VALUES (3,'G003','ปวส.1/1 คอมพิวเตอร์ธุรกิจ','ปวส.','คอมพิวเตอร์ธุรกิจ',0,'[1,2,3,4,5]');
INSERT INTO `student_groups` (`id`, `code`, `name`, `level`, `department`, `isDualVocational`, `studyDays`) VALUES (4,'G004','ปวส.1/2 คอมพิวเตอร์ธุรกิจ','ปวส.','คอมพิวเตอร์ธุรกิจ',1,'[1,2,3]');
INSERT INTO `student_groups` (`id`, `code`, `name`, `level`, `department`, `isDualVocational`, `studyDays`) VALUES (5,'G005','ปวช.1/1 การบัญชี','ปวช.','การบัญชี',0,'[1,2,3,4,5]');
INSERT INTO `student_groups` (`id`, `code`, `name`, `level`, `department`, `isDualVocational`, `studyDays`) VALUES (6,'G006','ปวช.1/2 การบัญชี','ปวช.','การบัญชี',0,'[1,2,3,4,5]');
INSERT INTO `student_groups` (`id`, `code`, `name`, `level`, `department`, `isDualVocational`, `studyDays`) VALUES (7,'G007','ปวส.1/1 การบัญชี','ปวส.','การบัญชี',0,'[1,2,3,4,5]');
INSERT INTO `student_groups` (`id`, `code`, `name`, `level`, `department`, `isDualVocational`, `studyDays`) VALUES (8,'G008','ปวส.1/2 การบัญชี','ปวส.','การบัญชี',1,'[1,2,3]');
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (1,'670101001','มานะ จันทร์แก้ว',1,0,15);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (2,'670101002','สุริยา แก้วกาญจนา',1,0,16);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (3,'670101003','สมชาย โพธิ์ทอง',1,0,17);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (4,'670101004','ปิยะ อินทร์แก้ว',1,0,18);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (5,'670101005','สมชาย ทองดี',1,0,19);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (6,'670101006','สมชาย ทองดี',1,0,20);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (7,'670101007','วิชัย อินทร์แก้ว',1,0,21);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (8,'670101008','จันทร์เพ็ญ ศรีสุข',1,0,22);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (9,'670101009','ศักดิ์ชัย อินทร์แก้ว',1,0,23);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (10,'670101010','อนงค์ ใจดี',1,0,24);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (11,'670101011','สมชาย โพธิ์ทอง',1,0,25);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (12,'670101012','รัตนา พรหมมา',1,0,26);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (13,'670101013','กมล พิมพ์ทอง',1,0,27);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (14,'670101014','เกียรติ พิมพ์ทอง',1,0,28);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (15,'670101015','ธนา ทองดี',1,0,29);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (16,'670101016','วิชัย ศรีภูมิ',1,0,30);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (17,'670101017','บุญมี จันทร์แก้ว',1,0,31);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (18,'670101018','พรทิพย์ สายสุข',1,0,32);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (19,'670101019','สมหญิง พรหมมา',1,0,33);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (20,'670101020','พรทิพย์ โพธิ์ทอง',1,0,34);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (21,'670102001','สุดา อินทร์แก้ว',2,0,35);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (22,'670102002','อรุณ ศรีภูมิ',2,0,36);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (23,'670102003','อนงค์ พรหมมา',2,0,37);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (24,'670102004','จันทร์เพ็ญ ทองดี',2,0,38);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (25,'670102005','สมชาย จันทร์แก้ว',2,0,39);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (26,'670102006','บุญมี พรหมมา',2,0,40);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (27,'670102007','ธนา ศรีภูมิ',2,0,41);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (28,'670102008','อรุณ ใจดี',2,0,42);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (29,'670102009','กมล จันทร์แก้ว',2,0,43);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (30,'670102010','สมหญิง แก้วกาญจนา',2,0,44);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (31,'670102011','ปิยะ บุญมา',2,0,45);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (32,'670102012','ประยุทธ สายสุข',2,0,46);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (33,'670102013','ศักดิ์ชัย สายสุข',2,0,47);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (34,'670102014','เกียรติ พรหมมา',2,0,48);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (35,'670102015','อรุณ โพธิ์ทอง',2,0,49);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (36,'670102016','บุญมี จันทร์แก้ว',2,0,50);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (37,'670102017','ธนา จันทร์แก้ว',2,0,51);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (38,'670102018','วิชัย โพธิ์ทอง',2,0,52);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (39,'670102019','รัตนา ใจดี',2,0,53);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (40,'670102020','มานะ สายสุข',2,0,54);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (41,'670111001','สมชาย สายสุข',3,0,55);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (42,'670111002','ธนา พรหมมา',3,0,56);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (43,'670111003','จันทร์เพ็ญ ใจดี',3,0,57);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (44,'670111004','อำไพ โพธิ์ทอง',3,0,58);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (45,'670111005','บุญมี สายสุข',3,0,59);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (46,'670111006','รัตนา ทองดี',3,0,60);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (47,'670111007','ศักดิ์ชัย โพธิ์ทอง',3,0,61);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (48,'670111008','อรุณ อินทร์แก้ว',3,0,62);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (49,'670111009','พรทิพย์ สายสุข',3,0,63);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (50,'670111010','วิชัย ใจดี',3,0,64);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (51,'670111011','พรทิพย์ ศรีภูมิ',3,0,65);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (52,'670111012','สมหญิง ใจดี',3,0,66);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (53,'670111013','เกียรติ บุญมา',3,0,67);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (54,'670111014','สุดา แก้วกาญจนา',3,0,68);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (55,'670111015','จันทร์เพ็ญ อินทร์แก้ว',3,0,69);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (56,'670111016','สุดา บุญมา',3,0,70);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (57,'670111017','วิชัย พิมพ์ทอง',3,0,71);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (58,'670111018','อำไพ สายสุข',3,0,72);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (59,'670111019','ธนา ทองดี',3,0,73);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (60,'670111020','สมชาย พิมพ์ทอง',3,0,74);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (61,'670112001','สมหญิง ศรีภูมิ',4,1,75);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (62,'670112002','ศักดิ์ชัย จันทร์แก้ว',4,1,76);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (63,'670112003','ธนา พิมพ์ทอง',4,1,77);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (64,'670112004','ปิยะ พิมพ์ทอง',4,1,78);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (65,'670112005','กมล ทองดี',4,1,79);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (66,'670112006','ศักดิ์ชัย อินทร์แก้ว',4,1,80);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (67,'670112007','ประยุทธ โพธิ์ทอง',4,1,81);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (68,'670112008','ประยุทธ แก้วกาญจนา',4,1,82);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (69,'670112009','รัตนา ศรีสุข',4,1,83);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (70,'670112010','ศักดิ์ชัย ใจดี',4,1,84);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (71,'670112011','สมหญิง บุญมา',4,1,85);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (72,'670112012','บุญมี แก้วกาญจนา',4,1,86);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (73,'670112013','อำไพ ศรีภูมิ',4,1,87);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (74,'670112014','จันทร์เพ็ญ อินทร์แก้ว',4,1,88);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (75,'670112015','จันทร์เพ็ญ จันทร์แก้ว',4,1,89);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (76,'670112016','สมหญิง จันทร์แก้ว',4,1,90);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (77,'670112017','สุดา พรหมมา',4,1,91);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (78,'670112018','วิชัย ใจดี',4,1,92);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (79,'670112019','วิชัย ศรีภูมิ',4,1,93);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (80,'670112020','กมล จันทร์แก้ว',4,1,94);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (81,'670201001','มานะ อินทร์แก้ว',5,0,95);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (82,'670201002','ศักดิ์ชัย สายสุข',5,0,96);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (83,'670201003','สุดา อินทร์แก้ว',5,0,97);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (84,'670201004','กมล สายสุข',5,0,98);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (85,'670201005','ปิยะ ทองดี',5,0,99);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (86,'670201006','พรทิพย์ พิมพ์ทอง',5,0,100);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (87,'670201007','กมล พิมพ์ทอง',5,0,101);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (88,'670201008','ศักดิ์ชัย จันทร์แก้ว',5,0,102);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (89,'670201009','ประยุทธ อินทร์แก้ว',5,0,103);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (90,'670201010','เกียรติ อินทร์แก้ว',5,0,104);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (91,'670201011','อนงค์ ทองดี',5,0,105);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (92,'670201012','พรทิพย์ แก้วกาญจนา',5,0,106);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (93,'670201013','มานะ พรหมมา',5,0,107);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (94,'670201014','กมล จันทร์แก้ว',5,0,108);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (95,'670201015','พรทิพย์ แก้วกาญจนา',5,0,109);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (96,'670201016','อนงค์ ศรีสุข',5,0,110);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (97,'670201017','ประยุทธ ศรีสุข',5,0,111);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (98,'670201018','รัตนา ทองดี',5,0,112);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (99,'670201019','วิชัย อินทร์แก้ว',5,0,113);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (100,'670201020','สุดา อินทร์แก้ว',5,0,114);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (101,'670202001','อำไพ ทองดี',6,0,115);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (102,'670202002','กมล ศรีภูมิ',6,0,116);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (103,'670202003','รัตนา ใจดี',6,0,117);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (104,'670202004','อำไพ พรหมมา',6,0,118);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (105,'670202005','สุริยา บุญมา',6,0,119);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (106,'670202006','สุดา พิมพ์ทอง',6,0,120);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (107,'670202007','เกียรติ จันทร์แก้ว',6,0,121);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (108,'670202008','รัตนา สายสุข',6,0,122);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (109,'670202009','รัตนา พรหมมา',6,0,123);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (110,'670202010','นภา ศรีสุข',6,0,124);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (111,'670202011','ประยุทธ อินทร์แก้ว',6,0,125);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (112,'670202012','สุริยา พรหมมา',6,0,126);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (113,'670202013','กมล พิมพ์ทอง',6,0,127);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (114,'670202014','วิชัย ใจดี',6,0,128);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (115,'670202015','บุญมี ศรีภูมิ',6,0,129);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (116,'670202016','ปิยะ พรหมมา',6,0,130);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (117,'670202017','อำไพ ศรีสุข',6,0,131);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (118,'670202018','อำไพ แก้วกาญจนา',6,0,132);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (119,'670202019','สุริยา โพธิ์ทอง',6,0,133);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (120,'670202020','ศักดิ์ชัย พรหมมา',6,0,134);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (121,'670211001','ประยุทธ ศรีภูมิ',7,0,135);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (122,'670211002','กมล บุญมา',7,0,136);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (123,'670211003','วิชัย สายสุข',7,0,137);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (124,'670211004','บุญมี พิมพ์ทอง',7,0,138);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (125,'670211005','กมล พรหมมา',7,0,139);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (126,'670211006','ศักดิ์ชัย ใจดี',7,0,140);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (127,'670211007','รัตนา ศรีภูมิ',7,0,141);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (128,'670211008','รัตนา ทองดี',7,0,142);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (129,'670211009','อนงค์ บุญมา',7,0,143);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (130,'670211010','อรุณ แก้วกาญจนา',7,0,144);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (131,'670211011','รัตนา ใจดี',7,0,145);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (132,'670211012','ปิยะ ศรีภูมิ',7,0,146);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (133,'670211013','รัตนา อินทร์แก้ว',7,0,147);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (134,'670211014','ศักดิ์ชัย สายสุข',7,0,148);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (135,'670211015','ประยุทธ สายสุข',7,0,149);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (136,'670211016','อรุณ จันทร์แก้ว',7,0,150);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (137,'670211017','สุดา อินทร์แก้ว',7,0,151);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (138,'670211018','มานะ อินทร์แก้ว',7,0,152);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (139,'670211019','พรทิพย์ ศรีสุข',7,0,153);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (140,'670211020','กมล พิมพ์ทอง',7,0,154);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (141,'670212001','นภา ศรีสุข',8,1,155);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (142,'670212002','จันทร์เพ็ญ อินทร์แก้ว',8,1,156);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (143,'670212003','พรทิพย์ โพธิ์ทอง',8,1,157);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (144,'670212004','เกียรติ จันทร์แก้ว',8,1,158);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (145,'670212005','พรทิพย์ บุญมา',8,1,159);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (146,'670212006','มานะ อินทร์แก้ว',8,1,160);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (147,'670212007','พรทิพย์ บุญมา',8,1,161);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (148,'670212008','สมหญิง ศรีภูมิ',8,1,162);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (149,'670212009','กมล โพธิ์ทอง',8,1,163);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (150,'670212010','เกียรติ ทองดี',8,1,164);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (151,'670212011','จันทร์เพ็ญ ทองดี',8,1,165);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (152,'670212012','นภา บุญมา',8,1,166);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (153,'670212013','ธนา จันทร์แก้ว',8,1,167);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (154,'670212014','สมชาย พิมพ์ทอง',8,1,168);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (155,'670212015','รัตนา ใจดี',8,1,169);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (156,'670212016','ธนา แก้วกาญจนา',8,1,170);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (157,'670212017','นภา จันทร์แก้ว',8,1,171);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (158,'670212018','อรุณ โพธิ์ทอง',8,1,172);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (159,'670212019','บุญมี จันทร์แก้ว',8,1,173);
INSERT INTO `students` (`id`, `studentCode`, `fullName`, `groupId`, `isDualVocational`, `userId`) VALUES (160,'670212020','กมล สายสุข',8,1,174);
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (1,'2000-1001','ภาษาอังกฤษ 1',2,0,'LECTURE');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (2,'2000-1002','คณิตศาสตร์ 2',2,0,'LECTURE');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (3,'2000-1003','วิทยาศาสตร์ 3',2,0,'LECTURE');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (4,'2000-1004','สังคมศึกษา 4',2,0,'LECTURE');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (5,'20001-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 1',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (6,'20002-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 2',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (7,'20003-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 3',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (8,'20004-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 4',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (9,'20005-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 5',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (10,'20006-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 6',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (11,'20007-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 7',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (12,'20008-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 8',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (13,'20009-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 9',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (14,'20010-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 10',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (15,'20011-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 11',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (16,'20012-1000','คอมพิวเตอร์ธุรกิจ ปวช.1 วิชาชีพ 12',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (17,'30101-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 1',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (18,'30102-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 2',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (19,'30103-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 3',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (20,'30104-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 4',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (21,'30105-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 5',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (22,'30106-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 6',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (23,'30107-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 7',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (24,'30108-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 8',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (25,'30109-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 9',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (26,'30110-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 10',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (27,'30111-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 11',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (28,'30112-1002','คอมพิวเตอร์ธุรกิจ ปวส.1 วิชาชีพ 12',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (29,'21001-1004','การบัญชี ปวช.1 วิชาชีพ 1',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (30,'21002-1004','การบัญชี ปวช.1 วิชาชีพ 2',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (31,'21003-1004','การบัญชี ปวช.1 วิชาชีพ 3',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (32,'21004-1004','การบัญชี ปวช.1 วิชาชีพ 4',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (33,'21005-1004','การบัญชี ปวช.1 วิชาชีพ 5',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (34,'21006-1004','การบัญชี ปวช.1 วิชาชีพ 6',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (35,'21007-1004','การบัญชี ปวช.1 วิชาชีพ 7',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (36,'21008-1004','การบัญชี ปวช.1 วิชาชีพ 8',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (37,'21009-1004','การบัญชี ปวช.1 วิชาชีพ 9',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (38,'21010-1004','การบัญชี ปวช.1 วิชาชีพ 10',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (39,'21011-1004','การบัญชี ปวช.1 วิชาชีพ 11',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (40,'21012-1004','การบัญชี ปวช.1 วิชาชีพ 12',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (41,'31101-1006','การบัญชี ปวส.1 วิชาชีพ 1',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (42,'31102-1006','การบัญชี ปวส.1 วิชาชีพ 2',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (43,'31103-1006','การบัญชี ปวส.1 วิชาชีพ 3',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (44,'31104-1006','การบัญชี ปวส.1 วิชาชีพ 4',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (45,'31105-1006','การบัญชี ปวส.1 วิชาชีพ 5',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (46,'31106-1006','การบัญชี ปวส.1 วิชาชีพ 6',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (47,'31107-1006','การบัญชี ปวส.1 วิชาชีพ 7',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (48,'31108-1006','การบัญชี ปวส.1 วิชาชีพ 8',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (49,'31109-1006','การบัญชี ปวส.1 วิชาชีพ 9',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (50,'31110-1006','การบัญชี ปวส.1 วิชาชีพ 10',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (51,'31111-1006','การบัญชี ปวส.1 วิชาชีพ 11',1,2,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (52,'31112-1006','การบัญชี ปวส.1 วิชาชีพ 12',1,1,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (53,'30204-2101','การเขียนโปรแกรมเว็บ (ปฏิบัติ)',0,3,'COMPUTER');
INSERT INTO `subjects` (`id`, `code`, `name`, `theoryHours`, `practiceHours`, `requiredRoomType`) VALUES (54,'30204-2102','สัมมนาวิชาชีพ',1,0,'LECTURE');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (2,24,'[]','MORNING');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (3,24,'[{\"day\":1,\"period\":3},{\"day\":1,\"period\":4},{\"day\":2,\"period\":7}]','MORNING');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (4,24,'[{\"day\":2,\"period\":9},{\"day\":5,\"period\":3},{\"day\":1,\"period\":3},{\"day\":1,\"period\":4},{\"day\":2,\"period\":7}]','ANY');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (5,24,'[{\"day\":1,\"period\":3},{\"day\":1,\"period\":4},{\"day\":2,\"period\":7},{\"day\":1,\"period\":3},{\"day\":1,\"period\":4},{\"day\":2,\"period\":7}]','MORNING');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (6,24,'[{\"day\":2,\"period\":3},{\"day\":1,\"period\":3},{\"day\":1,\"period\":4},{\"day\":2,\"period\":7}]','ANY');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (7,24,'[{\"day\":2,\"period\":6},{\"day\":3,\"period\":9},{\"day\":1,\"period\":3},{\"day\":1,\"period\":4},{\"day\":2,\"period\":7}]','AFTERNOON');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (8,24,'[{\"day\":1,\"period\":3},{\"day\":1,\"period\":4},{\"day\":2,\"period\":7},{\"day\":1,\"period\":3},{\"day\":1,\"period\":4},{\"day\":2,\"period\":7}]','ANY');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (9,24,'[{\"day\":2,\"period\":4}]','ANY');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (10,24,'[{\"day\":3,\"period\":4},{\"day\":4,\"period\":8}]','MORNING');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (11,24,'[]','ANY');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (12,24,'[]','AFTERNOON');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (13,24,'[{\"day\":1,\"period\":1},{\"day\":1,\"period\":2},{\"day\":1,\"period\":7},{\"day\":1,\"period\":8},{\"day\":1,\"period\":9},{\"day\":1,\"period\":10},{\"day\":2,\"period\":1},{\"day\":2,\"period\":2},{\"day\":2,\"period\":3},{\"day\":2,\"period\":4},{\"day\":2,\"period\":6},{\"day\":2,\"period\":8},{\"day\":2,\"period\":9},{\"day\":2,\"period\":10},{\"day\":3,\"period\":1},{\"day\":3,\"period\":2},{\"day\":3,\"period\":3},{\"day\":3,\"period\":4},{\"day\":3,\"period\":6},{\"day\":3,\"period\":7},{\"day\":3,\"period\":8},{\"day\":3,\"period\":9},{\"day\":3,\"period\":10},{\"day\":4,\"period\":1},{\"day\":4,\"period\":2},{\"day\":4,\"period\":3},{\"day\":4,\"period\":4},{\"day\":4,\"period\":6},{\"day\":4,\"period\":7},{\"day\":4,\"period\":8},{\"day\":4,\"period\":9},{\"day\":4,\"period\":10},{\"day\":5,\"period\":1},{\"day\":5,\"period\":2},{\"day\":5,\"period\":3},{\"day\":5,\"period\":4},{\"day\":5,\"period\":6},{\"day\":5,\"period\":7},{\"day\":5,\"period\":8},{\"day\":5,\"period\":9},{\"day\":5,\"period\":10}]','ANY');
INSERT INTO `teachers_constraints` (`teacherId`, `maxHoursPerWeek`, `unavailableSlots`, `preferredTime`) VALUES (14,6,'[{\"day\":1,\"period\":1},{\"day\":1,\"period\":2},{\"day\":1,\"period\":3},{\"day\":1,\"period\":4},{\"day\":1,\"period\":7},{\"day\":1,\"period\":8},{\"day\":1,\"period\":9},{\"day\":1,\"period\":10},{\"day\":2,\"period\":1},{\"day\":2,\"period\":2},{\"day\":2,\"period\":3},{\"day\":2,\"period\":4},{\"day\":2,\"period\":6},{\"day\":2,\"period\":7},{\"day\":2,\"period\":8},{\"day\":2,\"period\":9},{\"day\":2,\"period\":10},{\"day\":3,\"period\":1},{\"day\":3,\"period\":2},{\"day\":3,\"period\":3},{\"day\":3,\"period\":4},{\"day\":3,\"period\":6},{\"day\":3,\"period\":7},{\"day\":3,\"period\":8},{\"day\":3,\"period\":9},{\"day\":3,\"period\":10},{\"day\":4,\"period\":1},{\"day\":4,\"period\":2},{\"day\":4,\"period\":3},{\"day\":4,\"period\":4},{\"day\":4,\"period\":6},{\"day\":4,\"period\":7},{\"day\":4,\"period\":8},{\"day\":4,\"period\":9},{\"day\":4,\"period\":10},{\"day\":5,\"period\":1},{\"day\":5,\"period\":2},{\"day\":5,\"period\":3},{\"day\":5,\"period\":4},{\"day\":5,\"period\":6},{\"day\":5,\"period\":7},{\"day\":5,\"period\":8},{\"day\":5,\"period\":9},{\"day\":5,\"period\":10}]','ANY');
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (1,1,1,'08:00','09:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (2,1,2,'09:00','10:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (3,1,3,'10:00','11:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (4,1,4,'11:00','12:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (5,1,5,'12:00','13:00',1);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (6,1,6,'13:00','14:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (7,1,7,'14:00','15:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (8,1,8,'15:00','16:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (9,1,9,'16:00','17:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (10,1,10,'17:00','18:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (11,2,1,'08:00','09:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (12,2,2,'09:00','10:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (13,2,3,'10:00','11:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (14,2,4,'11:00','12:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (15,2,5,'12:00','13:00',1);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (16,2,6,'13:00','14:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (17,2,7,'14:00','15:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (18,2,8,'15:00','16:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (19,2,9,'16:00','17:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (20,2,10,'17:00','18:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (21,3,1,'08:00','09:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (22,3,2,'09:00','10:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (23,3,3,'10:00','11:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (24,3,4,'11:00','12:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (25,3,5,'12:00','13:00',1);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (26,3,6,'13:00','14:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (27,3,7,'14:00','15:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (28,3,8,'15:00','16:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (29,3,9,'16:00','17:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (30,3,10,'17:00','18:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (31,4,1,'08:00','09:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (32,4,2,'09:00','10:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (33,4,3,'10:00','11:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (34,4,4,'11:00','12:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (35,4,5,'12:00','13:00',1);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (36,4,6,'13:00','14:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (37,4,7,'14:00','15:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (38,4,8,'15:00','16:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (39,4,9,'16:00','17:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (40,4,10,'17:00','18:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (41,5,1,'08:00','09:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (42,5,2,'09:00','10:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (43,5,3,'10:00','11:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (44,5,4,'11:00','12:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (45,5,5,'12:00','13:00',1);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (46,5,6,'13:00','14:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (47,5,7,'14:00','15:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (48,5,8,'15:00','16:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (49,5,9,'16:00','17:00',0);
INSERT INTO `timeslots` (`id`, `dayOfWeek`, `periodNo`, `startTime`, `endTime`, `isLunchBreak`) VALUES (50,5,10,'17:00','18:00',0);
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (1,'admin','35de122b3f49b865aa82fdcf35990ade:8876aa77003b9795b97d37273a02e348f9852b18bbd9d923d76ba857f516cd90','ฝ่ายวิชาการ (ผู้ดูแลระบบ)','ADMIN','ฝ่ายบริหาร','รองผู้อำนวยการฝ่ายวิชาการ','0812345678','academic@ptc.ac.th',NULL,'2026-11-19 06:24:55.827');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (2,'T0001','3702cf374cb66980cc016330b7ec81a8:239ed1f454f0546bb6a95bbce53d1c7e6683fa268ad84847b1e4b77d223d1a42','ครูกมล อินทร์แก้ว','TEACHER','สามัญสัมพันธ์','หัวหน้าแผนกวิชา','0810000000','t0001@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (3,'T0002','567cfad0a809e37d510b6835dc91ad51:7c860923067190242b106abeb8cb156d820f70f53d68f1626523a85fa3b2de70','ครูศักดิ์ชัย แก้วกาญจนา','TEACHER','สามัญสัมพันธ์','ครู','0810007919','t0002@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (4,'T0003','cb89f73eb8eb114f792845bb24ba93bc:74861d8128bd22921df8c8cd3ab999d8f93f4e3a5137daf0df7ae997bc11d5ef','ครูอำไพ สายสุข','TEACHER','สามัญสัมพันธ์','ครู','0810015838','t0003@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (5,'T0004','6398400278d8516f3341805fe71d57b5:092e5ef4789e91928c2dac4fc8733ec5465307201c4624cce7787ddff50c499a','ครูสุดา ศรีสุข','TEACHER','คอมพิวเตอร์ธุรกิจ','หัวหน้าแผนกวิชา','0810023757','t0004@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (6,'T0005','8471b06e73fb644b53665774801668a8:5e4259374cf825b5616f3d4408fd43bc06b52782decd82fe0eb5ae226a6d4193','ครูประยุทธ โพธิ์ทอง','TEACHER','คอมพิวเตอร์ธุรกิจ','ครู','0810031676','t0005@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (7,'T0006','b87ef269e15af88f9cb3532f0c6ed8a3:f3c60619c3c3f405fd52d2f246273d7bf6a5ca7a9f030880074022e252ad8a00','ครูสุริยา พิมพ์ทอง','TEACHER','คอมพิวเตอร์ธุรกิจ','ครูพิเศษสอน','0810039595','t0006@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (8,'T0007','abf109460a22582bb8bc1b6c4eed7efe:b37d20e9c90640a2e805f27d28524e3c6711c3e1bb43420af90ea839a79e148d','ครูกมล พิมพ์ทอง','TEACHER','คอมพิวเตอร์ธุรกิจ','ครู','0810047514','t0007@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (9,'T0008','703859925fa83a4cdc6aea71eb3833df:ebef3e3262fffe2773e3b214afdb8cd573730ea5372b9cc3471503a9304c7bda','ครูเกียรติ ศรีสุข','TEACHER','การบัญชี','หัวหน้าแผนกวิชา','0810055433','t0008@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (10,'T0009','93db1dcf61af97605891bca70ccda350:92c8ab13598f67563b45202e79d76d49009bb7048dfab28cd0b867dce2443490','ครูจันทร์เพ็ญ พิมพ์ทอง','TEACHER','การบัญชี','ครู','0810063352','t0009@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (11,'T0010','652029cf7c92e9618ff5bb4f59efcdd8:acd13e3a8afc46a4914110a691f6c0a47653f24398cf1d244fcf3a6601d925e2','ครูเกียรติ ทองดี','TEACHER','การบัญชี','ครู','0810071271','t0010@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (12,'T0011','460f91cd168003a3afde42ea2fc3b5f3:e870c642cc9ce6d41b6e10b05baddbe60b4586499b2689ed8037bab81d6ea7fd','ครูปิยะ ทองดี','TEACHER','การบัญชี','ครูพิเศษสอน','0810079190','t0011@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (13,'T-FIX-01','54bd4b21208f4d7be4962101c563af60:93cc2d4ae6057a673628864a8413edb4e760d47da1f97edecd7321a6413aa17d','ครูสมศรี ใจดี','TEACHER','คอมพิวเตอร์ธุรกิจ','ครู','0810087109','t-fix-01@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (14,'T-FIX-02','1509a9ce26c6d33f1d3a17af075a5814:be7c8fc435079711b9eeed31ca279838e4f5257151d7337b377b97860cbfd692','ครูวิชัย ทองดี','TEACHER','คอมพิวเตอร์ธุรกิจ','ครูพิเศษสอน','0810095028','t-fix-02@ptc.ac.th',NULL,'2026-11-19 06:24:56.143');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (15,'670101001','3b0fc500a6d2e674df6fad1d84a9285e:1dc480ce59c739ffcce9fc280f754cfa89bde87b4f1447fc066b292feeb9f283','มานะ จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (16,'670101002','28493c3f0dc28b89b5c6d0268ee4bd9f:88a0be034d1f63cc1a28213bec8b419ebf896ba4acb6668f751973cb2b87f588','สุริยา แก้วกาญจนา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (17,'670101003','b427e65b769ed45fc69d55fb4898778f:128e2357cba2002141560159f980797b58c6bb7c6c2698b2a0edb675036259ce','สมชาย โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (18,'670101004','0301866b0e53222464fe185d3e835ab0:9ab344e9379741e8ab5fa1025c0a9f25556919bbed3bd5fee5a0389f936b9f7e','ปิยะ อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (19,'670101005','54dbb4990f2493aa25bac89bf375cb76:db6990e93f94db05fcf215d2257dfee705a3773e56104348dc4cab1b05ce6cae','สมชาย ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (20,'670101006','8d90d26804c84217eac2d671f25d087e:d51a5c604e87ee400c23fbecbb6f60da52e391aa972f0ef83d0e3b952cf566fc','สมชาย ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (21,'670101007','07133560ae7d8be7457195205a7248bf:f0b46c6b438556fa5c79b3ab0bb1da2f1435ebc4cd5ff9780c05db5b239fbaa0','วิชัย อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (22,'670101008','7698c61a45415e18ce1e13e17bdf5672:b36be7ffa8ddad65c4cb7d0564d15a9ccf0c183a4adbda63abf37d5db97db74e','จันทร์เพ็ญ ศรีสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (23,'670101009','4e7bbc87631ed19a9f2d149f8f6aad8e:798a1e1176c8db77e7aaf8daf4af4fb17a9b88af03d5729637d199d617b33b7b','ศักดิ์ชัย อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (24,'670101010','b37ed7575b3e87d75cce190e63ff0bd1:c340f00298db8db6546222a5a5298180d4df089d255610ca69308c3f7ffc8e4f','อนงค์ ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (25,'670101011','b2a53d955055c2b715e6107cf11f48cd:cac77b0c545191fa11184f33770b68ba6608165a744fbd46985326cb8ba8eb37','สมชาย โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (26,'670101012','8e71d9abeed16e4f04774ce13cc167e3:b892eb30e33f52eecce39568743f32fb6b64835514f305e8e7b270a7137416b9','รัตนา พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (27,'670101013','1acbccfc0017af9ed6b0c8e5b9540121:73e17dacc753d486f70715ba8ebe830d1c0b783a819b620405e1eb541a7a4942','กมล พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (28,'670101014','8d05dcdee8f4b014d52be82f57935c95:ac1126d53b80c2de5c37671e16f2fb665fdb92f3f8e51ecfcfaae21c2fb7f346','เกียรติ พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (29,'670101015','ebc19a4fdc6a10a7707c3ac20db0e6f0:14e69a50dc17278f5c437c66cbd31398bb96f238eb9e4c8c9adeb98346d49a79','ธนา ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (30,'670101016','d333144ec8043e64c5c7227034bdf945:e005d02465ada33cc67fd9ec267607e59980af36806002c45bde05f3c7297a94','วิชัย ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (31,'670101017','9bc2f6eb0c85ff7914b77aebc40573b7:49cc6a371f981f3814850ce15777352e8c66204a44f4adab23acd733d1906b9f','บุญมี จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (32,'670101018','87a06e87f5aeae2ca509ba0056144f52:668068cb45ea7caaf1936bff82314352392190bf747205c59bd7abf84a49203f','พรทิพย์ สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (33,'670101019','6e55264fed57c6f07af836805b54fc96:c6aaeef53c404377ed9339d6ec5c759b599b95d2bf419c9ca38e7d49ca4171ca','สมหญิง พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (34,'670101020','b7aa46145bbecf4e0960f460e79331b3:1c376cee9556027d906d8d9e66081317287063461cf3c0a672762da457f8051b','พรทิพย์ โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (35,'670102001','4245fef943fc7cce60d5e40c4cefb5ea:a6f9283e6170332850599016162c93fa72f8f2a205cc6d2da21f073bbb64c7fa','สุดา อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (36,'670102002','65b09f0bfb0e31599c4442a3f0c334c0:75be02e256f89c90d3ae190af61925158aee78605bba930bb9f70d5cb6fc7bcb','อรุณ ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (37,'670102003','64864759038c009be1b07e1fa8b294c7:dae06cd59ec2152167ccce132e26d2b5c5745989ab36423cdac4683973c48bf7','อนงค์ พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (38,'670102004','96ed731ab69af911a9851ad42fa65617:a6e083e5973c7ea08a0855d14d2581133ed70334f972af2d4d56a0f855560b43','จันทร์เพ็ญ ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (39,'670102005','b9e473a7b0e1ccd33f3c93560f61a032:639614e376d0f52a348d8a91ca8a08b56091f3f3dd347e9e32ae7aa4a09db55a','สมชาย จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (40,'670102006','8ae0d2a38355969950d2657b9b192945:7185c68be62c7e199bd8cd36620306bba54ca29f4f27ece69839711df1491c67','บุญมี พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (41,'670102007','5918255be39e708f7231f2db6cb570d6:4ccdcdc86555d712986a93623e91a4127bf80f4e63f4f44c67dee49bc32d8c70','ธนา ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (42,'670102008','12857ee9c49db6cf2cf532807cf5f6f2:50acaf7fb8948c8787a6ce407a65c76c1b5665251fcb78f5947201aaee1eca31','อรุณ ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (43,'670102009','c641d73c1fba50d88ce5551c2010409b:1fc48f89f910c2c9147efb082f7bfa1bede1a1894ea6c9addc33f90497b1dfbf','กมล จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (44,'670102010','fb85ade000a8393d4db26374575a9411:85ca0053cc9466711be19b77dd77d20dcdf92b445e09d5b5736313f64de8d96c','สมหญิง แก้วกาญจนา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (45,'670102011','ba775712a16638bafd2c7d23f1fc13b5:5b41945600cec190f3910ba22d6bd73d2d2c8514cc578c618d4edd7e70b4c6fd','ปิยะ บุญมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (46,'670102012','86bf986d22d17c05e166f73626bbf9d9:6fb5e8bf98023f4cad816e84c53d60a842dffc5500227af2bb27edbdbf0d5d26','ประยุทธ สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (47,'670102013','8a52bc61a2bc4150b25a6763f4fe3ad2:2634966122b206109bdf44269ecf2e801e3b99ead4530d21d4b4c3624474bcd7','ศักดิ์ชัย สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (48,'670102014','1183ee9b2ef4017c47bf393c9b61e0b2:6a6db643ed63a9fdfa21aff10e534e260c68bb8d86d6867fa53e46641d62e80d','เกียรติ พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (49,'670102015','0b024bee87c2525212ef5619573b96e5:fee9d34542a62c99ac7de451f29ba7319e5760ccf319a96610f4ec112de51041','อรุณ โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (50,'670102016','65d72d5f352fc74782541211cd900c9a:bd790011f95d348ab4b625d7d82bdabb250bc96ac5d84b25674b6c5696e496b3','บุญมี จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (51,'670102017','0c5128100da3e52a6d8f9203e17a4d10:3803726498009e1121e813b6d2f4f345cd226a43fe32ceff3c0528808ca40d78','ธนา จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (52,'670102018','9937e1a1d5383fa1b9388f8cfed9db54:5dea1cfa1d2dd027d260307a464d7a93316ee3e70cf793ffe2c02adcba14350a','วิชัย โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (53,'670102019','4d1f617eac92096dd3dee8f6e654b12a:13d27bcc0720dd58bcf578c1c1a28856b7a8267627d1598d817f0e97e46f97bc','รัตนา ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (54,'670102020','76082821f475e4c01a40e6d380c8d4b1:b446f391bd947b026cea00ac30feb931e97a9d9cc02468fd609803e4ce4a12fa','มานะ สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (55,'670111001','d23a1b2c2b306ade580405d17ba36ea1:6bcdef808298140291aa7c6f2a1991894a5f258cafb9b58509e85ac6e1941d3b','สมชาย สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (56,'670111002','aec4916aca7d00c82bdf0bd8531d52cc:f33068a8e9793b75309fb9fa7c677a35c63123b579732cc2e8e397781caf7a22','ธนา พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (57,'670111003','c7dafa869f4d1e5a1d596099b4137eb5:0c21e4c2d417ac1425ae63f3cf7f8a3ea42c56455e749324f467f57177854089','จันทร์เพ็ญ ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (58,'670111004','16c9f175b9f920f67c971a4b06079bfc:3b0cb1e9c855a0123be6be2ed4e0b103d239ca27fefb4c6291b117b765cf8525','อำไพ โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (59,'670111005','5f78529652898391d11e82aead2fd3db:5c250f4e54aa16cccf909cfc887e5b1fedeaec529768d2c1506332ebbea85881','บุญมี สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (60,'670111006','4ce991581e94d4219e4b594f285611bf:47cfaa6b6ee10d40267c7ec1a611c59f44dc50b0b28888540588c0ce594fc822','รัตนา ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (61,'670111007','d82714ffa213bb33609c27c9fe7ebddc:34bd1b5cd8fa89a0bda4f997a7edd6d0d9a3b314eb5c94ef28adcf72f2af33be','ศักดิ์ชัย โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (62,'670111008','18028386cfdb031930851f1149374f8a:3b9c4f8ffa3ab634ac06f2cbd9324e088b29cf187a7f79d0275a13c56882aca6','อรุณ อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (63,'670111009','3de863289f653cd75f5d0ea07b533dc3:60e784df13ad5bcefd619fe083c36edf2d885a11434fc8a81e775c6e231b7a72','พรทิพย์ สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (64,'670111010','449de8be295077b6c6db1241ddbcd2ed:f60d1ba6991c79107af27a228695baa6b81572d0a7c11d70f1b7a72ea8ecb976','วิชัย ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (65,'670111011','088493ad837e48f979ff9851811dea5d:b00be55ce059a74f8b69da971f81f23deee17621c2462310ba8822fd5dbc55f2','พรทิพย์ ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (66,'670111012','727c19a9f121c1b6f1e26afc811baefc:39a7b4a842aadc47383647f4cfccbaae0c86d1bbddc36012f50a887b8ca0c839','สมหญิง ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (67,'670111013','f6540534bdd716a564bdc004119cf15d:2be8f196078ab23faf030b021727dc740c261d0a9e50e031a1bdf9c08bcdab1c','เกียรติ บุญมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (68,'670111014','0f32349996917332429d674cc84e49dd:5ce89cf8932306b19b3db64a40b5166654d78edd9ab412d481b4d26042c48f6d','สุดา แก้วกาญจนา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (69,'670111015','3bbd994373e90efd08ba5b82e69486f7:7aca7378502e5258cef735f06334adf38fc7cd3c5bc1cfd8f715644bfab4bcda','จันทร์เพ็ญ อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (70,'670111016','fac29f78658f2546f396a0919f842363:189c09eff839c8db31326a7c0f281619e33ca9b41589256e9ce10c5f0392bdfa','สุดา บุญมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (71,'670111017','794d6391a5f5048b028d3e9d3ddc32a1:4e2b833348b7df553c389038975a8b49f0ab8a3b7d5dba4dbc76a26c9b0abfb1','วิชัย พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (72,'670111018','03d327241b77903dae48f63c213a90e4:00568c3812e05337ee4eabec30f15f0853a26b0b4888a3c4b4e3eb22db612baa','อำไพ สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (73,'670111019','d908a0c9abb99e5e386ad5a175002bb5:eb45812783b0fd21d4cb4d8006b76fea25019df5241a2d4ba07312bb05767b68','ธนา ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (74,'670111020','22df07196c2192b6369a5bc429ddd9a3:43e3462cc3dd532fba44cc0c4834627883e3b50d2f65b7b7604f5500edb821d3','สมชาย พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (75,'670112001','beab0128463e4f172c88143ae9c9a1e8:26968ee124173b9eb61790b5e40277d3fef55a38db46224695bdeb067ef6f949','สมหญิง ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (76,'670112002','75138780823ed4c9ce58284266e94032:5562afe7f0f759253a358dfa78fe8aecac8401ebb57110f03fc3d7e4c8a76209','ศักดิ์ชัย จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (77,'670112003','d49b46fcad442e45459f47c6c3e085ff:76587888961321bb1c3a7d9c07832b3f1ec7a67a5fef0e7b6649b206c13f8ac6','ธนา พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (78,'670112004','2ef80ab9d5bcd2cee1cbfe71abc06cba:8e3c584cd21efad8aff14d118a03536c12a7bb2b254a4640b247ea666bee9bfe','ปิยะ พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (79,'670112005','ca7bb7fd5b066e73186576ce5392892f:20a8995266f9ac69075ee4ef8843223b65bb45c880f8632f53f79e8333b7cc89','กมล ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (80,'670112006','db470bd84edc36881af4150c002c7cf6:9e0438e98765c3d456b01eb9da20de8fa62c3d225edd9cd0aa36b984f32e0647','ศักดิ์ชัย อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (81,'670112007','232bf53e1b4c6784f557538979598bd8:8ba99790ea9fd9ab16cbd156f47cc153bedbeefe65472495a2b50874abbe734a','ประยุทธ โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (82,'670112008','16dc393904134351584f8c57f38435e4:5e20c1378d4664a9cd5b2972bfa313c9d4337de62755a0c845e3978f9812cc57','ประยุทธ แก้วกาญจนา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (83,'670112009','d18f422e207e82c0512b61d526dab163:ded55cec6905bc1e660dfaf0003dfbe4d1eb09655f91606cc38d5d949d1d6f4f','รัตนา ศรีสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (84,'670112010','3feb6117663e3beff7c321b716088b9b:2dacace822b5784098bf06742fc485ddca0c4b0fb26c2b83cc93bbe85c1376fe','ศักดิ์ชัย ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (85,'670112011','e4679eb837067ddb2c45e7120aad8e1e:bae7bf10190ee3bb6cc4fe1b59f2b125547987c070ec0d20ec10f72406adfc05','สมหญิง บุญมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (86,'670112012','dbf231c194d4476785dd3b1a2081d995:dfdc584b330b0a31b62ec32f953a0ce195f21cc9fd923332903d4e2b9f9826ce','บุญมี แก้วกาญจนา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (87,'670112013','6f9850434a21b462a74089e51b4da37a:5b269a5c137d0d58db42db75d51c0167b6b901b49eeea39b678b83b6511faead','อำไพ ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (88,'670112014','7a5dc4cbebb6871dee3cf6574f49efc4:1e12a5ccd2977b4de0fcd7b1ceb8e65bbe9e5401fd5e5933f802a2b2b1b6310e','จันทร์เพ็ญ อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (89,'670112015','dcb1479b0802d0f794af2f19832c2d8d:61ae97eb8ce64c2fecd3c80ce795709daf9ced345d43b5118c4cefca86ae31d6','จันทร์เพ็ญ จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (90,'670112016','578d32e75a855ae83a18bd14e4b3c290:12fe5cae3136f116cf0ff720983f66f66a1fed5a80c5342dfb6720f3a0418503','สมหญิง จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (91,'670112017','573ed1a13bb955103c588026ffb9e8b6:90065dea7f5a00f56cd4a4ad1a82124f91031c3d2e4500dd79320d413a0c3423','สุดา พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (92,'670112018','cf1029f1b0a32ef8e7618211bccafcd3:95b736295c677a2611bd0e259134a35cc59363860494222f5bd67a1f7729d7ae','วิชัย ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (93,'670112019','73b1548328f9f877d6b33fa85d5331c3:56f6fdfc98aefa398dc1947f7dbe1d4ba1f1d76afb57bd74c7782b8c73c35a9f','วิชัย ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (94,'670112020','cd36d3b85eeb4fa45484c5bb1557c5da:1d0a82f7e122854b021d392202ec8a5551d92b6af2584c907138620e3276e7ef','กมล จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (95,'670201001','824e6b4fdd2df5c5ff3b8510f9a3fa68:9f6e892343adb37ed708130d040cbd46c293cbdaaa44a7db3f3a9400ef7ff3d2','มานะ อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (96,'670201002','1ca30ff9af45a135d2d2074c95c79ea1:375b76717dd55e9c59cb8c821097ba0974ffbd36417f8dbe83fc024cb89f6dec','ศักดิ์ชัย สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (97,'670201003','36650e112eade3432facb390bb11bf67:c23913c7fe54ff1bb378a24ac0287033e81b1b6e5948afb27cf9e5ccc6498eec','สุดา อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (98,'670201004','ab5e5905a7219a1a21f365a858f4bf3f:b949184c5408e90ab03a5afb5c37a06c8cf6ae91141d35cd4062e500abfd07b3','กมล สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (99,'670201005','8d3368b99fb86a6bd3210bf6ac0455e2:bd15d35649898152d5027eafcf18f018bbe68269612a716c9816d0a708e8bc84','ปิยะ ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (100,'670201006','8a200cd9208714e71839698202d3becc:d914a8d93726f26d06a7db486ebcd3ec23206ba4092c7b4fcd0d1a1eadd38e31','พรทิพย์ พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (101,'670201007','fc649d8035c8fa826920bbfc82faac58:835ccde771783d98fcd653d1262784663919c19b49165947ac66c9a6b0fe5526','กมล พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (102,'670201008','67e4c75b33b57329eda3ad9d1e93c9de:bfb2cbc27d3546ee629d3d47ad9753894b07f01751ddb6437f7b9ca0ec4f9aef','ศักดิ์ชัย จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (103,'670201009','29df24b3557c4518a45ecb9d69062b9f:d7b611b3ff8f50400e9b2545b4235788cd7af9d85e2d7d02d408833b23295897','ประยุทธ อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (104,'670201010','c0a33f381305484a44913d6fb71f2e37:37e1ea8989ec4ef82c972a51e7af608ba3d55065291b2b3a0740ff5b496b3839','เกียรติ อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (105,'670201011','9d877273b3dbd9f3703d3de1bb7f47a0:a3d171477c947b112c47492751310d343d1dd76458c140f077e25345c8e57702','อนงค์ ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (106,'670201012','16134d6fe59a0c3a448d6e4e18a53d5f:46b3216c96e07e99abd1561d8906a64f58f1c015135ec1c7456a956ed33d7332','พรทิพย์ แก้วกาญจนา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (107,'670201013','807bc899fb85d5ed0a6b17653bd285b4:d0805cf530470169ed8a0f87fea08d97125585145880dc5ba676c49342e97502','มานะ พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (108,'670201014','e81958f2c89fbbe58eedd2143b27fa9f:bf40385be2bcfc387de8d4a88543dd5fc9803a09d682753e339437fd0d457102','กมล จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (109,'670201015','6aa66772e8509ac08349dc434e306e52:ad074cc77fc35397de17753d4e29f2dd86572900d1ba77936106635c3f9483a7','พรทิพย์ แก้วกาญจนา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (110,'670201016','3d45b4f576e0388a3c1c68bb74954906:d503a61febeadc138bf3434cc37b33b3d629471c187507ed033ab3db6eaa803c','อนงค์ ศรีสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (111,'670201017','b1f083cedcc5692b135e733746ae9b26:f98d2e9422a063edcb21075430f5206425185467c3d9aab90ca5085806d751b6','ประยุทธ ศรีสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (112,'670201018','f14134986654b2bfb927fc1adf4ec4ce:dee08b0ea8aefe98751a2f3434b0cf0b691cdaa262c2403398e0f7b4bca4ba67','รัตนา ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (113,'670201019','c8564fbca5783351d97d658eec6ad380:e235a888d61ee025e8b67a172000cebd4d1cfbdfb6a6faa8e1f8c83a62b2546c','วิชัย อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (114,'670201020','178cc27444b0ab289ad86ee04b521334:7474244c1a687e74b6596657514344625d74bb20d4345aedd7ff5cbf4fe20fe1','สุดา อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (115,'670202001','2b2def11753e4350531564a48cf91bd0:c4f5d5bfaa9029cec1365f36277ac288b2383dd7db924a35662c55510b2e8254','อำไพ ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (116,'670202002','20ee1a8ecedf7e77abfb5759157029bc:e2353e60826154365759590f016ff6776a9fe80f7146fe40b5ec59835e25447f','กมล ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (117,'670202003','8d3b910863ce2b0e4b6d28da6cc2af52:b5f80e3a40c01eaf47822504cdea27c58162691378f98ff9cb597b48e786e09f','รัตนา ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (118,'670202004','e3f0a28adca6be9fa57a2fec2c85e3f5:cfcdb885c9848efb347fd17768806513bdc0037f43058bc260a38d5ca1baaf48','อำไพ พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (119,'670202005','dca2b89a6297043f59ce353a823a5e1f:0a394a88b95d741e0e5619fdd3f3c53dceb206a79c9b853650cf284496c4203c','สุริยา บุญมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (120,'670202006','156b359c297c54da84dffce711335548:8d0c419e19d3dcbf4fd60506bfb9ffe4c24955e9422a2ea27d93dac63f43b3b4','สุดา พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (121,'670202007','712011c5228f960ec0acbf3882c2c56c:88c07fcbbd42bc1ea6010f0ba9bbf122cce0140736b406f0a8577dc642c50b65','เกียรติ จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (122,'670202008','e58ecf685b8da37b8b0e4836acb52032:df8047f5101a6f16c5e527adaefe5b6955b4802fff6524ce660e462913a89433','รัตนา สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (123,'670202009','630d44dfd1b45f94bd27ed07a47350e2:ed1c6e9d15450709e9e29bccc6478c16d0b1f155f54ef70788d27dd1aed37308','รัตนา พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (124,'670202010','e627c19afc20f0124e75273dc84051f6:aa6e7414e0dc6cd02335c3f4c1faf6a025ad7aebf51a5d60bda93aaa0f413b9c','นภา ศรีสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (125,'670202011','2518d2cb48da1bf96a959b4cfc8c1275:f6312369ddf159d6043a265a36b29a1b01114dfd0c55690ab1c858bae831ec05','ประยุทธ อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (126,'670202012','fc3a7b6b7224de47429c18004f2f09e1:7b78bb34547013d55e5daa2adde29db0e8b443e6c10499dc745bf0f9dd7708e9','สุริยา พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (127,'670202013','103e83c06cb3bd7b57a3ac7f617bc5ea:ebdcf8ae66b0d483c0ce438cd06f6952f976a5d5ff190b24120c1c7a9bbd55bc','กมล พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (128,'670202014','790212e9f746554025cfae93ca8f3b39:5f32c6f0cbc9a7d4980e03cf4a13e9450838da6d05d76fe7e483e45210efccab','วิชัย ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (129,'670202015','02350642b510586b8e71137947489cc4:4a6865b1cb311114767e16c593a6a89ba1b29302595e12d9afb75e9e5fee2db1','บุญมี ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (130,'670202016','913e4a8237d4b096d749f5b66a7b464d:382dbd3e08e90d4c674d1fbae2dc21e2eb838c3133855549f610fb329ceaeb14','ปิยะ พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (131,'670202017','6bf28395e07d29fbb2f7d2b3b45ebcac:8132826427aefe22e33546b2316b4caa2ef9354425e639ab4dafff3674f7ad09','อำไพ ศรีสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (132,'670202018','7341ab40cfe97e98be58be0c516fda79:60391bd804b6e571344719c9dbe7af338b027105e0170da6a5ee6be3fee97673','อำไพ แก้วกาญจนา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (133,'670202019','dd6bc633c46b66003bb2065b0c2a0bb2:4d375994806f64a86b8fe8924aa347e43593983adcfa53557ad6475af22556ee','สุริยา โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (134,'670202020','3e85aa7c811c5e066a75017c33902c38:af3a7199a7d793590cf63fc3f7f4c4e3b4e7ee65112f88ad46e690e32da93495','ศักดิ์ชัย พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (135,'670211001','144079f3ae6dc984c111ce0db5f6d3d7:7d7ba76665767eaeb7f9f4f427ed5c738ac687231118cc89561f92395a055d8f','ประยุทธ ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (136,'670211002','7b3165e4be93c7d2def60df3bc808033:d172b0d401171b51d20ef36403e0452a3f389e95bdbf0a5c4a073c180ae9aa67','กมล บุญมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (137,'670211003','30fa30290213253ce94a3567749f0f5a:831e6671fc3201989a144490e5a6ce9476d70f467b732def92f3252fb5a723fb','วิชัย สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (138,'670211004','70a91559c9347094291574a15d4b06cc:f10ead05d7a4661f6129c42cd3b80b3ec274473c7d807e2337869a7f3713c9ef','บุญมี พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (139,'670211005','171d2dcf59bf1d93d26780680e3d238f:4d1575a9aad3ee1d5b287c362f067820c0ca69806383ba816d7b5d39c8451054','กมล พรหมมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (140,'670211006','523fd8444dd93ed1c49624d98d4fe0aa:51974a2b09b6c2e126cb12c95de130fd62c9e5e43c059f481642c83fd7f687ca','ศักดิ์ชัย ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (141,'670211007','b9c0a877c59d1c4ec945f6d7ce0595e7:4654a2b76f227de8c1f0d5c839d5240ba993c01b4a69ffb838e7e0f8157660d8','รัตนา ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (142,'670211008','9bfb9a650353211bf082afed880b6583:2c7e3ecbe022db28db18061eb5eb2462ae341806d7f566b147329ba4999e3d3a','รัตนา ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (143,'670211009','cfba8d494db7071c21cf5f4a92743c0c:c2f40b4f9c72d289f389395c2e554491a53c93656bdb652b58cc0ca5751a7f90','อนงค์ บุญมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (144,'670211010','e0957d73a92efb58a68bab36fa55bee9:eec15200cfdad853ee16d7d20fcbaa0e7394c26265bba4f9473639f5990d764d','อรุณ แก้วกาญจนา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (145,'670211011','3f48cce9a86635cc4777394121851edc:269d58900a925db23577f2304715125839cb327b88720744eb005f8a5ed7836f','รัตนา ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (146,'670211012','a20c272b3142e1b3b435345b2d15fb5b:fb84bda5ba9efcf722ad8fa7534898b667e2a374afb3a8b6c5dbbe7a04ed9454','ปิยะ ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (147,'670211013','ad5c9362400efa0b3f4192d08e6e8f1d:97d5ddda047501b19c92a5e8e36d513ec11d823ec2c92f6fc891c51fb76cc38d','รัตนา อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (148,'670211014','b141f84498c7bebb17becb68ec28b2a4:055e022b16a91b6f9a87dc20a9957e6ead4f49c745d20ad3ffb67ac6dcec04da','ศักดิ์ชัย สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (149,'670211015','8508a1e30bfe738df6d1581cb62396be:2fd49db072f0f6ca63742c5e223e27d26288c1c5364fb631efbef3e2421017d1','ประยุทธ สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (150,'670211016','3f80da2ee48d8f69b122799966407387:f87b262e5c402899add98412e29fd42d1c261b9c617504d13fdfc5162a99a166','อรุณ จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (151,'670211017','141614673c074eb444d65ec494606fff:676a4385c38e60b788752dd6b72c59ab36792d59ebeba64b3da1d82bc21d1bfc','สุดา อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (152,'670211018','673c7ea80562ac2876cd83c43875bc58:7944b1cff71fe5fafcf6c99b4fe394bdadf433ef04c42418e1d103dfac18d6c2','มานะ อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (153,'670211019','791f7dc80dc5d6ac29fe131091ac867a:77f12563d632061c725103563dab7d3383c4e402aaf1777be2bb5d9cef1a985d','พรทิพย์ ศรีสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (154,'670211020','ce8f2cf8c66c40e4c98db6d0717a557d:5b83cccd8e7dfb88726d0c1f8940d5802157aeeefa897ed9c3ecd25fe40d1784','กมล พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (155,'670212001','7582803b2566c84ad4a6506c3e99387c:e74d84b2bfdca278040af41fae31ddb0308348662c03cdcf461409f84f478c60','นภา ศรีสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (156,'670212002','8f62b31701c2c7c4365231e2ae1184cd:89a95c74645de8187ba7646ae54d6f552cfe15d9a543150d956c2d114e583c4a','จันทร์เพ็ญ อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (157,'670212003','f843c77a7fe46e5174918f7134a4c8bc:2126dc5c266e5bede1bf5e34c27eb2260ba4cfbff13d64c9a4332d777ffba50b','พรทิพย์ โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (158,'670212004','89dca38fd1eef219f211fa2dbc3c118f:6341b22b02763c0d2bc4cc0ac0da19a78bf6d159e8be68f95b7c4b3202a38213','เกียรติ จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (159,'670212005','41f551a4c8b67f0cc426fc74c56ab8ed:3e99ab83d98f092ed7c6c07d17cf7c537ce7b25534f03a0bb05511fe58d73410','พรทิพย์ บุญมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (160,'670212006','6347db815c723f2189eff0350447ab56:4de61f56b77fa5dce1a886f328ac7107c6e5b8aa27e50a1a9323cdc43c0b4bff','มานะ อินทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (161,'670212007','35f4af43c5e7bab3462eae6b76eb70ae:a479760e73af1a2961a589c64be43b3e48b2b37eeb8f3583643617cf938eb32f','พรทิพย์ บุญมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (162,'670212008','bfd06d15e2fa4b04ed4c264b06fa0f98:ce6e579bc94ee1b1188f679438a020731d46d11f52845e51670638c384e15e51','สมหญิง ศรีภูมิ','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (163,'670212009','80a84cf5cf3569a0e80f8c50ca967507:c0e82b3aa997c0c88e9de8878a4ff9ef53bfc8b75c5a50c69844a6ddd9df149e','กมล โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (164,'670212010','ced75263c45d1942ae87c539a2340295:a50505a15e684b47361013b9f2cb76413f83fe6c6dd6b3039dde670b148b2b30','เกียรติ ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (165,'670212011','b5060609d40ebbabe6d7dfa209b923e4:0131a0781b675c68ad11a3c2e015488923aa48b31809991e635375da8353430a','จันทร์เพ็ญ ทองดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (166,'670212012','624ab3329fee23dee07fb8d23be71729:6baea6c4a5991f8b77e0838d946ee46d28ba04b9b11b00a8785cb01ceb98e6b4','นภา บุญมา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (167,'670212013','1b12cc8e945c8e48d0f6df9a3b5d2568:f07ee11606d82a1841f57fc4918e72aaee07d6f182eba68255d357fcba26798b','ธนา จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (168,'670212014','53d529691a8e2b81d8c2f37ecfbc28c3:1e950346332c527403c43b86ab2e7a577cd5695cbca4f51fc980df0cdee9f5b5','สมชาย พิมพ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (169,'670212015','637c31de485b66bd0181de9baf8431c3:fbe2de97ec45f5f2ffbf34b6faf809b714b586d2245360ccc598e5ce178c2374','รัตนา ใจดี','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (170,'670212016','f1bc84996e32631567bc3e626e2fff11:fa6d8f9a0f7b5e94ff19b1b111270aeebd211fd54f60222576bdd7d992f1e9d3','ธนา แก้วกาญจนา','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (171,'670212017','1ae6f7759a3922011f9735d573562b20:38bd0d70bc2e6ecae419d1f77792cc4f555122516198ae73b250db2c9bbc40f1','นภา จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (172,'670212018','1ea4ce85c9e48f1f3ad459d4fd98522b:a5afaa308e66d87fa84bf87ab3a6696d5470650e5711ae14b6185ab176872767','อรุณ โพธิ์ทอง','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (173,'670212019','dd94e6d0c065b66d3370d41ad20660e7:5a5d38eea478dc3c10cb65ea16bf78545bd03ce4d91864c593b741775bacbe45','บุญมี จันทร์แก้ว','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
INSERT INTO `users` (`id`, `username`, `passwordHash`, `fullName`, `role`, `department`, `position`, `phone`, `email`, `pdpaConsentAt`, `createdAt`) VALUES (174,'670212020','3fd07425bbc555997814e35a47a8893e:35df58b0030a1db09df659522da92f5e62625ef9c925b8188f49ed61934ee21a','กมล สายสุข','STUDENT',NULL,NULL,NULL,NULL,NULL,'2026-11-19 06:25:00.251');
SET FOREIGN_KEY_CHECKS = 1;
